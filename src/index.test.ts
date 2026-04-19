import { describe, expect, it } from 'vitest'
import type { ComponentKind, ComponentSpec, Renderer } from './index'
import { VERSION, builtins, hasKind, listKinds, register, unregister } from './index'

describe('stream-ui', () => {
  it('exports a version', () => {
    expect(VERSION).toBe('0.4.0')
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
      { kind: 'stack', children: [{ kind: 'text', content: 'inner' }] },
      { kind: 'row', children: [{ kind: 'badge', content: 'a' }], align: 'center' },
      { kind: 'grid', children: [{ kind: 'card', title: 'c1', body: '' }], columns: 2 },
      { kind: 'alert', variant: 'info', content: 'note' },
      { kind: 'badge', content: 'New', variant: 'success' },
      { kind: 'spinner', label: 'Loading' },
      { kind: 'progress', value: 50, max: 100, label: 'Working' },
      { kind: 'list', items: ['a', 'b'], ordered: true },
      { kind: 'table', headers: ['A'], rows: [['1'], ['2']] },
      { kind: 'input', name: 'q', label: 'Q', type: 'text', action: 'search' },
      { kind: 'textarea', name: 'note', label: 'Notes', rows: 3 },
      { kind: 'select', name: 'c', label: 'C', options: [{ value: 'a', label: 'A' }] },
      { kind: 'checkbox', name: 'x', label: 'X', checked: true },
      { kind: 'form', submitLabel: 'Save', fields: [{ name: 'a', label: 'A', type: 'text' }] },
      { kind: 'button', label: 'Go', action: 'go', variant: 'primary' },
      { kind: 'link', label: 'Open', href: 'https://example.com' },
    ]
    const kinds = new Set<ComponentKind>(specs.map((s) => s.kind))
    expect(kinds.size).toBe(23)
  })
})

describe('registry', () => {
  it('auto-registers all 23 built-ins on import', () => {
    const kinds = listKinds()
    expect(kinds).toContain('button')
    expect(kinds).toContain('card')
    expect(kinds).toContain('grid')
    expect(kinds.length).toBeGreaterThanOrEqual(23)
  })

  it('exposes built-ins as a typed map for direct invocation', () => {
    expect(typeof builtins.button).toBe('function')
    expect(typeof builtins.card).toBe('function')
  })

  it('lets consumers register and unregister custom kinds', () => {
    const customRenderer: Renderer = () => ({}) as HTMLElement
    expect(hasKind('test-custom')).toBe(false)

    register('test-custom', customRenderer)
    expect(hasKind('test-custom')).toBe(true)
    expect(listKinds()).toContain('test-custom')

    const removed = unregister('test-custom')
    expect(removed).toBe(true)
    expect(hasKind('test-custom')).toBe(false)
  })

  it('does not throw when unregistering a kind that does not exist', () => {
    expect(unregister('never-existed')).toBe(false)
  })
})
