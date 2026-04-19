// Scheme allowlist for agent-supplied URLs. A misaligned (or prompt-injected)
// agent could produce `javascript:`, `vbscript:`, or `file:` URLs that execute
// code or leak local paths when assigned to `src` / `href`. We normalize the
// input, accept only a narrow set of safe schemes, and fall back to a harmless
// `about:blank` (with a console warning) for anything else.

const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function safeHref(input: unknown): string {
  if (typeof input !== 'string') return 'about:blank'
  const trimmed = input.trim()
  if (trimmed === '') return 'about:blank'
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('?')) return trimmed
  try {
    const url = new URL(trimmed, 'http://_relative_')
    if (url.origin === 'http://_relative_') return trimmed
    if (SAFE_SCHEMES.has(url.protocol)) return url.toString()
  } catch {
    // fall through
  }
  if (typeof console !== 'undefined') {
    console.warn(`[stream-ui] rejected unsafe URL: ${trimmed}`)
  }
  return 'about:blank'
}

export function safeImageSrc(input: unknown): string {
  if (typeof input !== 'string') return ''
  const trimmed = input.trim()
  if (trimmed === '') return ''
  if (trimmed.startsWith('data:image/')) return trimmed
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return trimmed
  }
  try {
    const url = new URL(trimmed, 'http://_relative_')
    if (url.origin === 'http://_relative_') return trimmed
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
  } catch {
    // fall through
  }
  if (typeof console !== 'undefined') {
    console.warn(`[stream-ui] rejected unsafe image src: ${trimmed}`)
  }
  return ''
}
