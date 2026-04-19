import { describe, expect, it } from 'vitest'
import type { ComponentSpec } from './index'
import { VERSION } from './index'

describe('stream-ui', () => {
  it('exports a version', () => {
    expect(VERSION).toBe('0.1.0')
  })

  it('exports ComponentSpec discriminated union', () => {
    const specs: ComponentSpec[] = [
      { kind: 'text', content: 'hi' },
      { kind: 'card', title: 't', body: 'b' },
      { kind: 'button', label: 'go', action: 'demo' },
      { kind: 'list', items: ['a', 'b'] },
      { kind: 'form', submitLabel: 'Save', fields: [{ name: 'x', label: 'X', type: 'text' }] },
    ]
    expect(specs).toHaveLength(5)
  })
})
