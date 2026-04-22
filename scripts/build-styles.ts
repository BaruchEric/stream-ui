#!/usr/bin/env bun
/**
 * Concatenates generated design tokens with src/styles.css into
 * dist/styles.css, so published consumers get tokens + styles in one file
 * with no runtime `@import`.
 *
 * Run after tsup via `bun run build`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')

const tokens = readFileSync(join(ROOT, 'src', 'design-tokens.css'), 'utf8')
const styles = readFileSync(join(ROOT, 'src', 'styles.css'), 'utf8')

writeFileSync(join(ROOT, 'dist', 'styles.css'), `${tokens}\n${styles}`)
console.log('[build-styles] wrote dist/styles.css')
