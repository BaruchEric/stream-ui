import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stepCountIs, streamText, tool } from 'ai'
import { z } from 'zod'
import { BUILTIN_KINDS } from '../src/types'

// Vercel AI SDK's gateway provider reads AI_GATEWAY_API_KEY; accept the longer
// VERCEL_AI_GATEWAY_API_KEY as an alias. Run once at module load.
if (!process.env.AI_GATEWAY_API_KEY && process.env.VERCEL_AI_GATEWAY_API_KEY) {
  process.env.AI_GATEWAY_API_KEY = process.env.VERCEL_AI_GATEWAY_API_KEY
}

export const componentSpecSchema = z
  .object({
    kind: z.string().describe('Component kind, e.g. "button", "card", "alert"'),
  })
  .passthrough()
  .describe('A stream-ui ComponentSpec. Include all fields the kind expects.')

export type PlaygroundMessage =
  | { role: 'user'; kind: 'prompt'; text: string }
  | { role: 'user'; kind: 'form-submit'; name: string; fields: Record<string, unknown> }
  | { role: 'user'; kind: 'button-click'; action: string }
  | { role: 'assistant'; kind: 'thinking'; text: string }
  | { role: 'assistant'; kind: 'render' | 'append'; spec: unknown }

type CoreMessage = { role: 'user' | 'assistant'; content: string }

export function toCoreMessages(messages: PlaygroundMessage[]): CoreMessage[] {
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

function loadDesignGuide(): string | null {
  const candidates: string[] = [resolve(process.cwd(), 'DESIGN.md')]
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    candidates.push(resolve(here, '..', 'DESIGN.md'))
    candidates.push(resolve(here, '..', '..', 'DESIGN.md'))
  } catch {
    // no import.meta.url — rely on cwd candidate
  }
  for (const c of candidates) {
    try {
      return readFileSync(c, 'utf8')
    } catch {
      // try next
    }
  }
  return null
}

const DESIGN_GUIDE = loadDesignGuide()

export const systemPrompt = `You are a UI-generation agent for stream-ui.

stream-ui is a framework where JSON specs are rendered to DOM. Your job is to
take a user's natural-language prompt and produce UI by calling one of two
tools:

- render_ui(spec): replace the UI region with this component
- append_ui(spec): append this component to the existing UI region

Each spec is a JSON object: { kind, ...fields }.

Built-in kinds available:
${BUILTIN_KINDS.map((k) => `  - ${k}`).join('\n')}

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
  { kind: 'input', name: string, label: string, type?: string, action?: string,
    format?: 'email'|'phone'|'url'|'zip'|'credit-card',
    validation?: { required?: boolean, pattern?: string, minLength?: number,
      maxLength?: number, min?: number, max?: number, errorMessage?: string } }
  { kind: 'textarea', name: string, label: string, rows?: number,
    validation?: { ...same as input... } }
  { kind: 'form', submitLabel: string, fields: [
    { name, label, type, placeholder?, format?, validation? }, ...
  ] }
  { kind: 'list', items: string[], ordered?: boolean }
  { kind: 'table', headers: string[], rows: string[][] }

Input formats bundle validation + display masking:
  - 'email' → validates email address
  - 'phone' → validates 10-digit US phone + auto-formats as (555) 123-4567
  - 'url'   → validates http(s) URL
  - 'zip'   → validates 5 or 9 digit US zip + formats 12345-6789
  - 'credit-card' → validates 13-19 digits + formats as groups of 4

Guidelines:
1. Default to render_ui. Use append_ui only when the user says "add" or "also".
2. Compose: wrap groups of components in card/stack/row/grid rather than
   emitting many top-level appends.
3. Keep specs small, real, and purposeful. No placeholder lorem ipsum.
4. For interactive elements (button, input, form, link) always set a meaningful
   action or href that describes what the user should be able to do.
5. For fields that are emails / phone numbers / URLs / ZIP codes / credit cards,
   set the appropriate 'format' — don't just set 'type'. Use 'validation.required:
   true' when the field is mandatory. The framework handles both validation and
   display masking for you.
6. Think briefly about the goal before the first tool call.
7. If the latest user message is "[form submit: <name>] key="value" ...", the user
   submitted form <name>. Acknowledge or advance — e.g. render_ui a success card.
8. If the latest user message is "[button clicked: <action>]", the user clicked a
   button with that action. Continue the flow accordingly.${
     DESIGN_GUIDE
       ? `

---

## Design system (from DESIGN.md)

The following is the project's visual identity. Read the tokens to pick
component variants by *intent*, not hex values. Honor the Do's and Don'ts.

${DESIGN_GUIDE}`
       : ''
   }`

export type AgentEvent =
  | { type: 'thinking'; text: string }
  | { type: 'render'; spec: unknown }
  | { type: 'append'; spec: unknown }
  | { type: 'done' }
  | { type: 'error'; error: string }

export function sseEncode(event: AgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export function hasAnyApiKey(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL_AI_GATEWAY_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY,
  )
}

export function parseAgentBody(
  body: unknown,
): { messages: PlaygroundMessage[] } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Missing prompt or messages' }
  const b = body as { prompt?: unknown; messages?: unknown }
  if (Array.isArray(b.messages) && b.messages.length > 0) {
    return { messages: b.messages as PlaygroundMessage[] }
  }
  if (typeof b.prompt === 'string' && b.prompt.trim() !== '') {
    return { messages: [{ role: 'user', kind: 'prompt', text: b.prompt }] }
  }
  return { error: 'Missing prompt or messages' }
}

export async function runAgent(
  messages: PlaygroundMessage[],
  model: string,
  send: (event: AgentEvent) => void,
): Promise<void> {
  try {
    const result = streamText({
      model,
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
        const text = (part as { text?: string }).text ?? ''
        if (text) send({ type: 'thinking', text })
      } else if (part.type === 'tool-call') {
        const spec = (part as { input?: { spec?: unknown } }).input?.spec
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
  }
}
