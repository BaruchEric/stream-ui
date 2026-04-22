const MODEL = process.env.AI_MODEL ?? 'anthropic/claude-sonnet-4-6'

function hasAnyApiKey(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL_AI_GATEWAY_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY,
  )
}

export default function handler(_req: Request): Response {
  return Response.json({
    ok: true,
    model: MODEL,
    hasApiKey: hasAnyApiKey(),
  })
}
