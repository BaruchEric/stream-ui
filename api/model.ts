export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-6'

const MODEL_SLUG = /^[\w.-]+\/[\w.-]+$/

export function resolveModel(
  body: { model?: unknown } | undefined,
  env: { AI_MODEL?: string },
): string {
  const candidate = body && typeof body.model === 'string' ? body.model : ''
  if (candidate && MODEL_SLUG.test(candidate)) return candidate
  const fromEnv = env.AI_MODEL
  if (fromEnv && MODEL_SLUG.test(fromEnv)) return fromEnv
  return DEFAULT_MODEL
}
