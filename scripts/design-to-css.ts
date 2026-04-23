#!/usr/bin/env bun
/**
 * Reads DESIGN.md front matter and emits src/design-tokens.css.
 * Run via `bun run tokens`. Also invoked by `build` and `playground`.
 *
 * Supports a `variants.<name>.<group>` section for theme variants. `dark` is
 * emitted as both `@media (prefers-color-scheme: dark)` and an opt-in
 * `.sui-theme-<name>` class; any other variant name is emitted only as the
 * class, for explicit theme switching.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')
const SRC = join(ROOT, 'DESIGN.md')
const OUT = join(ROOT, 'src', 'design-tokens.css')

const file = readFileSync(SRC, 'utf8')
const match = file.match(/^---\r?\n([\s\S]*?)\r?\n---/)
if (!match) {
  console.error('[design-to-css] DESIGN.md: missing YAML front matter')
  process.exit(1)
}

const tokens = parseYaml(match[1]) as Record<string, unknown>

function kebab(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

// `{path.to.token}` → `var(--sui-path-to-token)`.
function resolveRef(value: string): string {
  const ref = value.match(/^\{(.+)\}$/)
  if (!ref) return value
  const path = ref[1].split('.').map(kebab).join('-')
  return `var(--sui-${path})`
}

// Biome's CSS linter prefers lowercase hex. Lower only `#RGB`/`#RRGGBB`/
// `#RRGGBBAA` tokens, never other strings.
function normalizeValue(value: string): string {
  return value.replace(/#[0-9A-Fa-f]{3,8}\b/g, (h) => h.toLowerCase())
}

const TOKEN_GROUPS = ['colors', 'typography', 'rounded', 'spacing', 'motion', 'components'] as const

function collectVars(source: Record<string, unknown>): string[] {
  const out: string[] = []
  function emit(obj: Record<string, unknown>, prefix: string): void {
    for (const [rawKey, rawVal] of Object.entries(obj)) {
      const key = kebab(rawKey)
      const varName = `--sui-${prefix}-${key}`
      if (typeof rawVal === 'string') {
        out.push(`${varName}: ${normalizeValue(resolveRef(rawVal))};`)
      } else if (typeof rawVal === 'number') {
        out.push(`${varName}: ${rawVal};`)
      } else if (rawVal && typeof rawVal === 'object' && !Array.isArray(rawVal)) {
        emit(rawVal as Record<string, unknown>, `${prefix}-${key}`)
      }
    }
  }
  for (const group of TOKEN_GROUPS) {
    const section = source[group]
    if (section && typeof section === 'object') {
      emit(section as Record<string, unknown>, kebab(group))
    }
  }
  return out
}

const lines: string[] = [
  '/* AUTO-GENERATED from DESIGN.md — do not edit by hand.',
  ' * Run `bun run tokens` to regenerate after changing DESIGN.md. */',
]

const rootVars = collectVars(tokens)
lines.push(':root {', ...rootVars.map((v) => `  ${v}`), '}')

const variants = tokens.variants
if (variants && typeof variants === 'object') {
  for (const [name, payload] of Object.entries(variants as Record<string, unknown>)) {
    if (!payload || typeof payload !== 'object') continue
    const variantVars = collectVars(payload as Record<string, unknown>)
    if (variantVars.length === 0) continue
    const className = `.sui-theme-${kebab(name)}`
    lines.push('', `${className} {`, ...variantVars.map((v) => `  ${v}`), '}')
    if (name === 'dark') {
      lines.push(
        '',
        '@media (prefers-color-scheme: dark) {',
        '  :root:not(.sui-theme-light) {',
        ...variantVars.map((v) => `    ${v}`),
        '  }',
        '}',
      )
    }
  }
}

lines.push('')

writeFileSync(OUT, lines.join('\n'))
console.log(`[design-to-css] wrote ${OUT}`)
