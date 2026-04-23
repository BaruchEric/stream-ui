import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('WWW-Authenticate', 'Basic realm="stream-ui playground"')
  res.status(401).send('Logged out')
}
