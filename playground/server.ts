// Playground LLM server. A tiny bun HTTP server that exposes POST /api/agent
// as an SSE stream of AgentEvents. The model (via Vercel AI Gateway) emits
// structured ComponentSpec JSON through two tools — render_ui / append_ui —
// and the server relays every tool call + reasoning delta back to the
// playground frontend, which feeds the existing render/append loop.
//
// Run:   bun run playground:server
// Env:   AI_GATEWAY_API_KEY=... (or VERCEL_AI_GATEWAY_API_KEY / ANTHROPIC_API_KEY
//        / OPENAI_API_KEY fallback). Parent-directory .env files are auto-loaded
//        so shared keys in e.g. ~/dev/.env propagate without copying.
// Model: override with AI_MODEL=provider/model-id (default: anthropic/claude-sonnet-4-6)

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { stepCountIs, streamText, tool } from 'ai'
import { z } from 'zod'

// Walk from cwd up to $HOME loading .env files with lowest priority — lets a
// shared ~/dev/.env provide keys without duplicating into every project .env.
function loadParentEnvFiles(): void {
  const home = process.env.HOME ?? '/'
  let dir = resolve(process.cwd(), '..')
  while (dir.startsWith(home) && dir !== home && dir !== '/') {
    const file = resolve(dir, '.env')
    if (existsSync(file)) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
        if (!m) continue
        const [, key, rawValue] = m
        if (process.env[key] !== undefined) continue
        process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
      }
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  // Also check $HOME itself.
  const homeEnv = resolve(home, '.env')
  if (existsSync(homeEnv)) {
    for (const line of readFileSync(homeEnv, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const [, key, rawValue] = m
      if (process.env[key] !== undefined) continue
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
    }
  }
}

loadParentEnvFiles()

// The Vercel AI SDK gateway provider reads AI_GATEWAY_API_KEY; accept the
// longer VERCEL_AI_GATEWAY_API_KEY as an alias.
if (!process.env.AI_GATEWAY_API_KEY && process.env.VERCEL_AI_GATEWAY_API_KEY) {
  process.env.AI_GATEWAY_API_KEY = process.env.VERCEL_AI_GATEWAY_API_KEY
}

const PORT = Number(process.env.PLAYGROUND_SERVER_PORT ?? 3030)
const MODEL = process.env.AI_MODEL ?? 'anthropic/claude-sonnet-4-6'

// Every ComponentSpec is a `{ kind, ...fields }` object. The built-in kinds
// are enumerated here only so the system prompt can list them; the schema
// itself stays permissive so the agent can also emit custom-registered kinds.
const KNOWN_KINDS = [
  'text',
  'heading',
  'paragraph',
  'code',
  'divider',
  'image',
  'card',
  'stack',
  'row',
  'grid',
  'alert',
  'badge',
  'spinner',
  'progress',
  'list',
  'table',
  'input',
  'textarea',
  'select',
  'checkbox',
  'form',
  'button',
  'link',
]

const componentSpecSchema = z
  .object({
    kind: z.string().describe('Component kind, e.g. "button", "card", "alert"'),
  })
  .passthrough()
  .describe('A stream-ui ComponentSpec. Include all fields the kind expects.')

type PlaygroundMessage =
  | { role: 'user'; kind: 'prompt'; text: string }
  | { role: 'user'; kind: 'form-submit'; name: string; fields: Record<string, unknown> }
  | { role: 'user'; kind: 'button-click'; action: string }
  | { role: 'assistant'; kind: 'thinking'; text: string }
  | { role: 'assistant'; kind: 'render' | 'append'; spec: unknown }

type CoreMessage = { role: 'user' | 'assistant'; content: string }

function toCoreMessages(messages: PlaygroundMessage[]): CoreMessage[] {
  return messages.map((m) => {
    if (m.role === 'user') {
      if (m.kind === 'prompt') return { role: 'user', content: m.text }
      if (m.kind === 'form-submit') {
        const body = Object.entries(m.fields)
          .map(([k, v]) => `${k}="${String(v)}"`)
          .join(' ')
        return { role: 'user', content: `[form submit: ${m.name}] ${body}` }
      }
      return { role: 'user', content: `[button clicked: ${m.action}]` }
    }
    if (m.kind === 'thinking') return { role: 'assistant', content: m.text }
    const tag = m.kind === 'render' ? '[render]' : '[append]'
    return { role: 'assistant', content: `${tag} ${JSON.stringify(m.spec)}` }
  })
}

const systemPrompt = `You are a UI-generation agent for stream-ui.

stream-ui is a framework where JSON specs are rendered to DOM. Your job is to
take a user's natural-language prompt and produce UI by calling one of two
tools:

- render_ui(spec): replace the UI region with this component
- append_ui(spec): append this component to the existing UI region

Each spec is a JSON object: { kind, ...fields }.

Built-in kinds available:
${KNOWN_KINDS.map((k) => `  - ${k}`).join('\n')}

Common spec shapes (partial reference):
  { kind: 'text', content: string }
  { kind: 'heading', level: 1|2|3|4|5|6, content: string }
  { kind: 'paragraph', content: string }
  { kind: 'card', title: string, body?: string, children?: Spec[] }
  { kind: 'stack'|'row'|'grid', children: Spec[], gap?: 'sm'|'md'|'lg' }
  { kind: 'alert', variant: 'info'|'success'|'warning'|'error', content: string }
  { kind: 'badge', content: string, variant?: 'default'|'success'|'warning'|'error' }
  { kind: 'button', label: string, action: string, variant?: 'default'|'primary'|'danger' }
  { kind: 'link', label: string, href: string }
  { kind: 'input', name: string, label: string, type?: string, action?: string }
  { kind: 'form', submitLabel: string, fields: [{name, label, type, placeholder?}, ...] }
  { kind: 'list', items: string[], ordered?: boolean }
  { kind: 'table', headers: string[], rows: string[][] }

Guidelines:
1. Default to render_ui. Use append_ui only when the user says "add" or "also".
2. Compose: wrap groups of components in card/stack/row/grid rather than
   emitting many top-level appends.
3. Keep specs small, real, and purposeful. No placeholder lorem ipsum.
4. For interactive elements (button, input, form, link) always set a meaningful
   action or href that describes what the user should be able to do.
5. Think briefly about the goal before the first tool call.
6. If the latest user message is "[form submit: <name>] key="value" ...", the user
   submitted form <name>. Acknowledge or advance — e.g. render_ui a success card.
7. If the latest user message is "[button clicked: <action>]", the user clicked a
   button with that action. Continue the flow accordingly.`

type AgentEvent =
  | { type: 'thinking'; text: string }
  | { type: 'render'; spec: unknown }
  | { type: 'append'; spec: unknown }
  | { type: 'done' }
  | { type: 'error'; error: string }

function sseEncode(event: AgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

async function handleAgent(req: Request): Promise<Response> {
  let messages: PlaygroundMessage[]
  try {
    const body = (await req.json()) as {
      prompt?: unknown
      messages?: unknown
    }
    if (Array.isArray(body.messages) && body.messages.length > 0) {
      messages = body.messages as PlaygroundMessage[]
    } else if (typeof body.prompt === 'string' && body.prompt.trim() !== '') {
      messages = [{ role: 'user', kind: 'prompt', text: body.prompt }]
    } else {
      return new Response('Missing prompt or messages', { status: 400 })
    }
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(sseEncode(event)))
      }

      try {
        const result = streamText({
          model: MODEL,
          system: systemPrompt,
          messages: toCoreMessages(messages),
          tools: {
            render_ui: tool({
              description: 'Render a component, replacing the existing UI.',
              inputSchema: z.object({ spec: componentSpecSchema }),
              execute: async () => ({ ok: true }),
            }),
            append_ui: tool({
              description: 'Append a component to the existing UI.',
              inputSchema: z.object({ spec: componentSpecSchema }),
              execute: async () => ({ ok: true }),
            }),
          },
          stopWhen: stepCountIs(8),
        })

        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            const text = (part as { text?: string; textDelta?: string }).text ?? ''
            if (text) send({ type: 'thinking', text })
          } else if (part.type === 'tool-call') {
            const input = (part as { input?: { spec?: unknown } }).input
            const spec = input?.spec
            if (!spec) continue
            if (part.toolName === 'render_ui') send({ type: 'render', spec })
            else if (part.toolName === 'append_ui') send({ type: 'append', spec })
          } else if (part.type === 'error') {
            const err = (part as { error?: unknown }).error
            send({ type: 'error', error: err instanceof Error ? err.message : String(err) })
          }
        }

        send({ type: 'done' })
      } catch (err) {
        send({
          type: 'error',
          error: err instanceof Error ? err.message : String(err),
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }
    if (req.method === 'POST' && url.pathname === '/api/agent') {
      return handleAgent(req)
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return Response.json({
        ok: true,
        model: MODEL,
        hasApiKey: Boolean(
          process.env.AI_GATEWAY_API_KEY ||
            process.env.ANTHROPIC_API_KEY ||
            process.env.OPENAI_API_KEY,
        ),
      })
    }
    return new Response('Not Found', { status: 404 })
  },
})

console.log(`[stream-ui] playground server listening on http://localhost:${server.port}`)
console.log(`[stream-ui] model: ${MODEL}`)
if (
  !process.env.AI_GATEWAY_API_KEY &&
  !process.env.ANTHROPIC_API_KEY &&
  !process.env.OPENAI_API_KEY
) {
  console.warn(
    '[stream-ui] WARNING: no AI_GATEWAY_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY set — calls will fail.',
  )
}
