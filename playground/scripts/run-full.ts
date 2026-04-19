// Runs both the playground's bun LLM server and the vite dev server in one
// process, so `bun run playground:full` Just Works. Kills both when one dies.
import { spawn } from 'node:child_process'

const children: ReturnType<typeof spawn>[] = []

function launch(name: string, cmd: string, args: string[]): void {
  const proc = spawn(cmd, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
  })
  proc.stdout?.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`)
  })
  proc.stderr?.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`)
  })
  proc.on('exit', (code) => {
    console.log(`[${name}] exited with code ${code}`)
    for (const other of children) {
      if (other !== proc && other.exitCode === null) other.kill('SIGTERM')
    }
    process.exit(code ?? 0)
  })
  children.push(proc)
}

launch('server', 'bun', ['run', '--watch', 'playground/server.ts'])
launch('vite', 'bun', ['run', 'playground'])

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    for (const child of children) child.kill('SIGTERM')
    process.exit(0)
  })
}
