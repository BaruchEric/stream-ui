import { beforeAll, describe, expect, it } from 'vitest'
import { generate } from './design-to-css'

describe('design-to-css generator', () => {
  // The generated file is the contract between DESIGN.md and every consumer
  // (styles.css, playground, agent-produced specs). These checks pin down the
  // specific tokens each downstream selector depends on so a drift in the
  // generator — or an unintended rename in DESIGN.md — fails loudly here
  // instead of showing up as a cosmetic regression in the browser.
  let out = ''
  beforeAll(() => {
    out = generate()
  })

  it('emits :root with every semantic color token styles.css references', () => {
    expect(out).toMatch(/^:root \{/m)
    for (const name of [
      '--sui-colors-primary:',
      '--sui-colors-primary-hover:',
      '--sui-colors-success:',
      '--sui-colors-warning:',
      '--sui-colors-error:',
      '--sui-colors-link:',
      '--sui-colors-on-primary:',
    ]) {
      expect(out).toContain(name)
    }
  })

  it('emits motion tokens used by button/link/progress transitions', () => {
    for (const name of [
      '--sui-motion-duration-fast:',
      '--sui-motion-duration-base:',
      '--sui-motion-easing-standard:',
    ]) {
      expect(out).toContain(name)
    }
  })

  it('resolves token references via var()', () => {
    expect(out).toContain(
      '--sui-components-button-primary-background-color: var(--sui-colors-primary);',
    )
  })

  it('emits dark variant as both class and prefers-color-scheme media query', () => {
    expect(out).toContain('.sui-theme-dark {')
    expect(out).toContain('@media (prefers-color-scheme: dark) {')
    expect(out).toContain(':root:not(.sui-theme-light) {')
  })

  it('lowercases hex values for biome compatibility', () => {
    // Uppercase hex would fail biome lint; DESIGN.md is authored uppercase.
    expect(out).not.toMatch(/#[0-9A-F]{3,8}\b/)
  })
})
