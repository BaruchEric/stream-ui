export const config = {
  matcher: ['/((?!_next/static|favicon.ico).*)'],
}

export default function middleware(req: Request): Response | undefined {
  const user = process.env.BASIC_AUTH_USER ?? 'admin'
  const pass = process.env.BASIC_AUTH_PASS
  if (!pass) return

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

  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="stream-ui playground"' },
  })
}
