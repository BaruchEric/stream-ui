export const config = {
  matcher: ['/((?!_next/static|favicon.ico).*)'],
}

const BASIC_REALM = 'stream-ui playground'
const isProd = process.env.VERCEL_ENV === 'production'

if (!process.env.BASIC_AUTH_PASS) {
  if (isProd) {
    console.warn(
      '[middleware] BASIC_AUTH_PASS is unset on production — all requests will be rejected.',
    )
  } else {
    console.warn('[middleware] BASIC_AUTH_PASS is unset — auth is disabled for this deployment.')
  }
}

export default function middleware(req: Request): Response | undefined {
  const user = process.env.BASIC_AUTH_USER ?? 'admin'
  const pass = process.env.BASIC_AUTH_PASS

  // No password configured: outside production we stay open (useful for
  // previews / local dev). In production we fail closed so a missing env var
  // can't silently expose the app.
  if (!pass) {
    if (!isProd) return
    return challenge('Authentication required (auth not configured)')
  }

  const header = req.headers.get('authorization') ?? ''
  if (header.startsWith('Basic ')) {
    const decoded = atob(header.slice(6))
    const sep = decoded.indexOf(':')
    if (sep !== -1) {
      const u = decoded.slice(0, sep)
      const p = decoded.slice(sep + 1)
      if (u === user && p === pass) return
    }
  }

  return challenge('Authentication required')
}

function challenge(body: string): Response {
  return new Response(body, {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${BASIC_REALM}"` },
  })
}
