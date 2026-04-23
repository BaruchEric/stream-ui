import type { VercelRequest, VercelResponse } from '@vercel/node'
import { type AgentEvent, parseAgentBody, runAgent, sseEncode } from './agent-core.js'
import { resolveModel } from './model.js'

export const config = {
  maxDuration: 300,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed')
    return
  }

  const parsed = parseAgentBody(req.body)
  if ('error' in parsed) {
    res.status(400).send(parsed.error)
    return
  }

  const model = resolveModel(req.body as { model?: unknown } | undefined, process.env)

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const send = (event: AgentEvent) => {
    res.write(sseEncode(event))
  }

  try {
    await runAgent(parsed.messages, model, send)
  } finally {
    res.end()
  }
}
