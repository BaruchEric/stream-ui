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
// Model: override with AI_MODEL=provider/model-id (default: from api/model.ts)

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import {
  type AgentEvent,
  hasAnyApiKey,
  parseAgentBody,
  runAgent,
  sseEncode,
} from '../api/agent-core'
import { DEFAULT_MODEL } from '../api/model'

function loadEnvFile(file: string): void {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const [, key, rawValue] = m
    if (process.env[key] !== undefined) continue
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
  }
}

// Walk from cwd up to $HOME loading .env files with lowest priority — lets a
// shared ~/dev/.env provide keys without duplicating into every project .env.
function loadParentEnvFiles(): void {
  const home = process.env.HOME ?? '/'
  let dir = resolve(process.cwd(), '..')
  while (dir.startsWith(home) && dir !== home && dir !== '/') {
    loadEnvFile(resolve(dir, '.env'))
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  loadEnvFile(resolve(home, '.env'))
}

loadParentEnvFiles()

const PORT = Number(process.env.PLAYGROUND_SERVER_PORT ?? 3030)
const MODEL = process.env.AI_MODEL ?? DEFAULT_MODEL

async function handleAgent(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }
  const parsed = parseAgentBody(body)
  if ('error' in parsed) return new Response(parsed.error, { status: 400 })

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(sseEncode(event)))
      }
      await runAgent(parsed.messages, MODEL, send)
      controller.close()
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
        hasApiKey: hasAnyApiKey(),
      })
    }
    return new Response('Not Found', { status: 404 })
  },
})

console.log(`[stream-ui] playground server listening on http://localhost:${server.port}`)
console.log(`[stream-ui] model: ${MODEL}`)
if (!hasAnyApiKey()) {
  console.warn(
    '[stream-ui] WARNING: no AI_GATEWAY_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY set — calls will fail.',
  )
}
