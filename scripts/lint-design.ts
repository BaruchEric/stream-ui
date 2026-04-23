#!/usr/bin/env bun
/**
 * Runs @google/design.md lint on DESIGN.md, prints a readable summary,
 * and exits non-zero when structural errors are present.
 *
 * Warnings are surfaced but do NOT fail the build — they typically
 * represent design-quality findings (contrast, unused tokens) that are
 * better treated as review signals than merge gates. Tighten to fail
 * on warnings when the team has cleaned the backlog.
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

// The CLI writes progress text to stdout before the JSON report. Pull
// out the final JSON object by scanning from the last standalone `{`.
const raw = r.stdout.toString()
const start = raw.lastIndexOf('\n{')
const jsonText = start >= 0 ? raw.slice(start + 1) : raw
let report: Report
try {
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

if (summary.errors > 0) {
  console.error('\n[lint:design] structural errors — failing build.')
  process.exit(1)
}
