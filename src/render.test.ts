import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { append, clear, render } from './index'

describe('render / append / clear', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  it('render replaces container content', () => {
    render({ kind: 'text', content: 'one' }, container)
    expect(container.textContent).toBe('one')
    render({ kind: 'text', content: 'two' }, container)
    expect(container.textContent).toBe('two')
    expect(container.children.length).toBe(1)
  })

  it('append keeps existing content', () => {
    render({ kind: 'text', content: 'a' }, container)
    append({ kind: 'text', content: 'b' }, container)
    expect(container.children.length).toBe(2)
  })

  it('clear empties the container', () => {
    render({ kind: 'text', content: 'x' }, container)
    clear(container)
    expect(container.children.length).toBe(0)
  })
})

describe('render — focus preservation', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  it('preserves focus on an input with the same name across re-render', () => {
    render(
      {
        kind: 'input',
        name: 'q',
        label: 'Search',
        value: 'hel',
        action: 'search',
      },
      container,
    )
    const first = container.querySelector('input') as HTMLInputElement
    first.focus()
    first.setSelectionRange(2, 2)
    expect(document.activeElement).toBe(first)

    render(
      {
        kind: 'input',
        name: 'q',
        label: 'Search',
        value: 'hello',
        action: 'search',
      },
      container,
    )
    const next = container.querySelector('input') as HTMLInputElement
    expect(next).not.toBe(first)
    expect(document.activeElement).toBe(next)
    expect(next.selectionStart).toBe(2)
    expect(next.selectionEnd).toBe(2)
  })

  it('preserves focus on a textarea with the same name across re-render', () => {
    render(
      {
        kind: 'textarea',
        name: 'notes',
        label: 'Notes',
        value: 'abc',
      },
      container,
    )
    const first = container.querySelector('textarea') as HTMLTextAreaElement
    first.focus()
    first.setSelectionRange(3, 3)

    render(
      {
        kind: 'textarea',
        name: 'notes',
        label: 'Notes',
        value: 'abcd',
      },
      container,
    )
    const next = container.querySelector('textarea') as HTMLTextAreaElement
    expect(document.activeElement).toBe(next)
    expect(next.selectionStart).toBe(3)
  })

  it('does not preserve focus when active element is outside container', () => {
    const outside = document.createElement('input')
    document.body.appendChild(outside)
    outside.focus()
    render({ kind: 'input', name: 'q', label: 'Q' }, container)
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })
})
