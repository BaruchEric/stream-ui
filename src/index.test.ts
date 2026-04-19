import { describe, expect, it } from 'vitest'
import type { ComponentKind, ComponentSpec } from './index'
import { VERSION } from './index'

describe('stream-ui', () => {
  it('exports a version', () => {
    expect(VERSION).toBe('0.2.0')
  })

  it('exports the ComponentSpec discriminated union covering all kinds', () => {
    const specs: ComponentSpec[] = [
      { kind: 'text', content: 'hi' },
      { kind: 'heading', level: 2, content: 'Title' },
      { kind: 'paragraph', content: 'A paragraph.' },
      { kind: 'code', content: "console.log('hi')", language: 'js' },
      { kind: 'divider' },
      { kind: 'image', src: 'x.png', alt: 'X' },
      { kind: 'card', title: 't', body: 'b' },
      { kind: 'alert', variant: 'info', content: 'note' },
      { kind: 'badge', content: 'New', variant: 'success' },
      { kind: 'spinner', label: 'Loading' },
      { kind: 'progress', value: 50, max: 100, label: 'Working' },
      { kind: 'list', items: ['a', 'b'], ordered: true },
      { kind: 'table', headers: ['A'], rows: [['1'], ['2']] },
      { kind: 'input', name: 'q', label: 'Q', type: 'text', action: 'search' },
      { kind: 'textarea', name: 'note', label: 'Notes', rows: 3 },
      {
        kind: 'select',
        name: 'c',
        label: 'C',
        options: [{ value: 'a', label: 'A' }],
      },
      { kind: 'checkbox', name: 'x', label: 'X', checked: true },
      { kind: 'form', submitLabel: 'Save', fields: [{ name: 'a', label: 'A', type: 'text' }] },
      { kind: 'button', label: 'Go', action: 'go', variant: 'primary' },
      { kind: 'link', label: 'Open', href: 'https://example.com' },
    ]

    const kinds = new Set<ComponentKind>(specs.map((s) => s.kind))
    expect(kinds.size).toBe(20)
  })
})
