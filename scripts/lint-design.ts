#!/usr/bin/env bun
/**
 * Runs @google/design.md lint on DESIGN.md, prints a readable summary,
 * and exits non-zero when errors OR warnings are present.
 *
 * Since the DESIGN.md baseline is currently at 0/0, any new warning is a
 * regression — unused tokens, failing WCAG contrast, etc. Block those at
 * PR time instead of letting them accumulate. If a warning becomes
 * intentional (rare), fix the root cause or relax this script.
 */
import { spawnSync } from 'node:child_process'

type Finding = { severity: 'error' | 'warning' | 'info'; path?: string; message: string }
type Report = {
  findings: Finding[]
  summary: { errors: number; warnings: number; infos: number }
}

const r = spawnSync('bunx', ['@google/design.md@latest', 'lint', '--format=json', 'DESIGN.md'], {
  encoding: 'utf8',
  stdio: ['inherit', 'pipe', 'pipe'],
})
if (r.error) {
  console.error('[lint:design] failed to spawn:', r.error.message)
  process.exit(2)
}

// The CLI writes progress text to stdout before the JSON report. Scan for the
// last balanced top-level `{…}` — more robust than substring heuristics when
// progress lines contain braces or the JSON starts at column 0.
function extractLastJson(raw: string): string | null {
  let last: string | null = null
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (inString) {
      if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        last = raw.slice(start, i + 1)
        start = -1
      }
    }
  }
  return last
}

const raw = r.stdout.toString()
const jsonText = extractLastJson(raw)
let report: Report
try {
  if (!jsonText) throw new Error('no JSON object found')
  report = JSON.parse(jsonText) as Report
} catch {
  console.error('[lint:design] could not parse lint output:')
  console.error(raw)
  process.exit(2)
}

const { findings, summary } = report
const byKind = { error: [] as Finding[], warning: [] as Finding[], info: [] as Finding[] }
for (const f of findings) byKind[f.severity]?.push(f)

const fmt = (f: Finding) => `  [${f.severity}]${f.path ? ` ${f.path}` : ''} — ${f.message}`

if (byKind.error.length) console.log(`Errors:\n${byKind.error.map(fmt).join('\n')}`)
if (byKind.warning.length) console.log(`Warnings:\n${byKind.warning.map(fmt).join('\n')}`)
if (byKind.info.length) console.log(`Info:\n${byKind.info.map(fmt).join('\n')}`)

console.log(
  `\nSummary: ${summary.errors} error(s), ${summary.warnings} warning(s), ${summary.infos} info.`,
)

if (summary.errors > 0 || summary.warnings > 0) {
  console.error(
    `\n[lint:design] ${summary.errors} error(s) + ${summary.warnings} warning(s) — failing build.`,
  )
  process.exit(1)
}
