import type { VercelRequest, VercelResponse } from '@vercel/node'
import { hasAnyApiKey } from './agent-core.js'
import { DEFAULT_MODEL } from './model.js'

const MODEL = process.env.AI_MODEL ?? DEFAULT_MODEL

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    model: MODEL,
    hasApiKey: hasAnyApiKey(),
  })
}
