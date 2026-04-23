#!/usr/bin/env bun
/**
 * Concatenates generated design tokens with src/styles.css into
 * dist/styles.css, so published consumers get tokens + styles in one file
 * with no runtime `@import`.
 *
 * Run after tsup via `bun run build`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')
const OUT = join(ROOT, 'dist', 'styles.css')

const [tokens, styles] = await Promise.all([
  Bun.file(join(ROOT, 'src', 'design-tokens.css')).text(),
  Bun.file(join(ROOT, 'src', 'styles.css')).text(),
])

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, `${tokens}\n${styles}`)
console.log('[build-styles] wrote dist/styles.css')
