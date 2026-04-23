import type { VercelRequest, VercelResponse } from '@vercel/node'
import { DEFAULT_MODEL } from './model.js'

const MODEL = process.env.AI_MODEL ?? DEFAULT_MODEL

function hasAnyApiKey(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL_AI_GATEWAY_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY,
  )
}

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    model: MODEL,
    hasApiKey: hasAnyApiKey(),
  })
}
