import { describe, expect, it, vi } from 'vitest'
import { builtins } from './index'

describe('builtins — DOM output', () => {
  it('text renders <p> with content', () => {
    const el = builtins.text({ kind: 'text', content: 'hello' })
    expect(el.tagName).toBe('P')
    expect(el.textContent).toBe('hello')
    expect(el.className).toBe('sui-text')
  })

  it('heading renders the correct level', () => {
    const h = builtins.heading({ kind: 'heading', level: 3, content: 'Title' })
    expect(h.tagName).toBe('H3')
    expect(h.textContent).toBe('Title')
  })

  it('heading defaults to level 2 when unspecified', () => {
    const h = builtins.heading({ kind: 'heading', content: 'T' })
    expect(h.tagName).toBe('H2')
  })

  it('paragraph renders <p>', () => {
    expect(builtins.paragraph({ kind: 'paragraph', content: 'x' }).tagName).toBe('P')
  })

  it('code renders <code> with language class', () => {
    const el = builtins.code({ kind: 'code', content: 'x', language: 'ts' })
    expect(el.tagName).toBe('CODE')
    expect(el.className).toContain('sui-code-ts')
  })

  it('divider renders <hr>', () => {
    expect(builtins.divider({ kind: 'divider' }).tagName).toBe('HR')
  })

  it('image sanitizes src and sets alt', () => {
    const el = builtins.image({
      kind: 'image',
      src: 'https://example.com/a.png',
      alt: 'a',
    }) as HTMLImageElement
    expect(el.tagName).toBe('IMG')
    expect(el.alt).toBe('a')
    expect(el.src).toContain('example.com/a.png')
  })

  it('image rejects javascript: URLs', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = builtins.image({
      kind: 'image',
      src: 'javascript:alert(1)',
      alt: 'bad',
    }) as HTMLImageElement
    expect(el.src).not.toContain('javascript')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('card renders <article> with title, body, and children', () => {
    const el = builtins.card({
      kind: 'card',
      title: 'T',
      body: 'B',
      children: [{ kind: 'text', content: 'child' }],
    })
    expect(el.tagName).toBe('ARTICLE')
    expect(el.querySelector('h3')?.textContent).toBe('T')
    expect(el.textContent).toContain('B')
    expect(el.textContent).toContain('child')
  })

  it('stack renders children with gap class', () => {
    const el = builtins.stack({
      kind: 'stack',
      gap: 'lg',
      children: [
        { kind: 'text', content: 'a' },
        { kind: 'text', content: 'b' },
      ],
    })
    expect(el.className).toContain('sui-gap-lg')
    expect(el.children.length).toBe(2)
  })

  it('row renders children with align class', () => {
    const el = builtins.row({
      kind: 'row',
      align: 'center',
      children: [{ kind: 'badge', content: 'x' }],
    })
    expect(el.className).toContain('sui-align-center')
  })

  it('grid exposes column count as CSS variable', () => {
    const el = builtins.grid({
      kind: 'grid',
      columns: 4,
      children: [{ kind: 'card', title: 'a' }],
    })
    expect(el.style.getPropertyValue('--sui-grid-cols')).toBe('4')
  })

  it('alert renders with role=alert for error variant', () => {
    const el = builtins.alert({ kind: 'alert', variant: 'error', content: 'bad' })
    expect(el.getAttribute('role')).toBe('alert')
    expect(el.className).toContain('sui-alert-error')
  })

  it('alert renders with role=status for non-error variants', () => {
    const el = builtins.alert({ kind: 'alert', variant: 'info', content: 'ok' })
    expect(el.getAttribute('role')).toBe('status')
  })

  it('badge renders <span> with variant class', () => {
    const el = builtins.badge({ kind: 'badge', content: 'New', variant: 'success' })
    expect(el.tagName).toBe('SPAN')
    expect(el.className).toContain('sui-badge-success')
  })

  it('spinner renders with role=status and optional label', () => {
    const el = builtins.spinner({ kind: 'spinner', label: 'Loading' })
    expect(el.getAttribute('role')).toBe('status')
    expect(el.textContent).toContain('Loading')
  })

  it('progress computes percentage correctly', () => {
    const el = builtins.progress({ kind: 'progress', value: 50, max: 100 })
    expect(el.getAttribute('role')).toBe('progressbar')
    expect(el.getAttribute('aria-valuenow')).toBe('50')
    const fill = el.querySelector('.sui-progress-fill') as HTMLElement
    expect(fill.style.width).toBe('50%')
  })

  it('list renders <ul> by default and <ol> when ordered', () => {
    expect(builtins.list({ kind: 'list', items: ['a'] }).tagName).toBe('UL')
    expect(builtins.list({ kind: 'list', items: ['a'], ordered: true }).tagName).toBe('OL')
  })

  it('table renders headers and rows', () => {
    const el = builtins.table({
      kind: 'table',
      headers: ['A', 'B'],
      rows: [
        ['1', '2'],
        ['3', '4'],
      ],
    })
    expect(el.tagName).toBe('TABLE')
    expect(el.querySelectorAll('th').length).toBe(2)
    expect(el.querySelectorAll('tbody tr').length).toBe(2)
    expect(el.querySelectorAll('tbody td').length).toBe(4)
  })

  it('input fires action on input event', () => {
    const onAction = vi.fn()
    const wrap = builtins.input(
      { kind: 'input', name: 'q', label: 'Q', action: 'search' },
      onAction,
    )
    const input = wrap.querySelector('input') as HTMLInputElement
    input.value = 'hello'
    input.dispatchEvent(new Event('input'))
    expect(onAction).toHaveBeenCalledWith({
      action: 'search',
      payload: { name: 'q', value: 'hello' },
    })
  })

  it('textarea respects rows and fires action', () => {
    const onAction = vi.fn()
    const wrap = builtins.textarea(
      { kind: 'textarea', name: 'n', label: 'N', rows: 6, action: 'note' },
      onAction,
    )
    const ta = wrap.querySelector('textarea') as HTMLTextAreaElement
    expect(Number(ta.rows)).toBe(6)
    ta.value = 'x'
    ta.dispatchEvent(new Event('input'))
    expect(onAction).toHaveBeenCalled()
  })

  it('select renders options and fires action', () => {
    const onAction = vi.fn()
    const wrap = builtins.select(
      {
        kind: 'select',
        name: 'c',
        label: 'C',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
        action: 'pick',
      },
      onAction,
    )
    const sel = wrap.querySelector('select') as HTMLSelectElement
    expect(sel.options.length).toBe(2)
    sel.value = 'b'
    sel.dispatchEvent(new Event('change'))
    expect(onAction).toHaveBeenCalledWith({
      action: 'pick',
      payload: { name: 'c', value: 'b' },
    })
  })

  it('checkbox fires action with checked payload', () => {
    const onAction = vi.fn()
    const wrap = builtins.checkbox(
      { kind: 'checkbox', name: 'x', label: 'X', action: 'toggle' },
      onAction,
    )
    const cb = wrap.querySelector('input[type="checkbox"]') as HTMLInputElement
    cb.checked = true
    cb.dispatchEvent(new Event('change'))
    expect(onAction).toHaveBeenCalledWith({
      action: 'toggle',
      payload: { name: 'x', checked: true },
    })
  })

  it('form gathers fields into payload on submit', () => {
    const onAction = vi.fn()
    const form = builtins.form(
      {
        kind: 'form',
        submitLabel: 'Save',
        fields: [
          { name: 'a', label: 'A', type: 'text' },
          { name: 'b', label: 'B', type: 'text' },
        ],
      },
      onAction,
    ) as HTMLFormElement
    const inputs = form.querySelectorAll('input') as NodeListOf<HTMLInputElement>
    inputs[0].value = '1'
    inputs[1].value = '2'
    form.dispatchEvent(new Event('submit', { cancelable: true }))
    expect(onAction).toHaveBeenCalledWith({
      action: 'submit:Save',
      payload: { a: '1', b: '2' },
    })
  })

  it('button fires action on click', () => {
    const onAction = vi.fn()
    const el = builtins.button({ kind: 'button', label: 'Go', action: 'go' }, onAction)
    expect(el.tagName).toBe('BUTTON')
    el.dispatchEvent(new Event('click'))
    expect(onAction).toHaveBeenCalledWith({ action: 'go' })
  })

  it('link sanitizes href and marks external with target=_blank', () => {
    const el = builtins.link({
      kind: 'link',
      label: 'go',
      href: 'https://example.com',
    }) as HTMLAnchorElement
    expect(el.tagName).toBe('A')
    expect(el.target).toBe('_blank')
    expect(el.rel).toContain('noopener')
  })

  it('link rejects javascript: URLs', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = builtins.link({
      kind: 'link',
      label: 'bad',
      href: 'javascript:alert(1)',
    }) as HTMLAnchorElement
    expect(el.href).not.toContain('javascript')
    warn.mockRestore()
  })
})

describe('input — validation + mask', () => {
  it('applies mask on input event', () => {
    const wrap = builtins.input({
      kind: 'input',
      name: 'phone',
      label: 'Phone',
      format: 'phone',
    })
    const input = wrap.querySelector('input') as HTMLInputElement
    input.value = '5551234567'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(input.value).toBe('(555) 123-4567')
  })

  it('shows error on blur when invalid', () => {
    const wrap = builtins.input({
      kind: 'input',
      name: 'email',
      label: 'Email',
      format: 'email',
      validation: { required: true },
    })
    const input = wrap.querySelector('input') as HTMLInputElement
    input.value = 'not-an-email'
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const err = wrap.querySelector('.sui-input-error')
    expect(err?.textContent).toBe('Enter a valid email')
  })

  it('clears error when value becomes valid', () => {
    const wrap = builtins.input({
      kind: 'input',
      name: 'email',
      label: 'Email',
      format: 'email',
    })
    const input = wrap.querySelector('input') as HTMLInputElement
    input.value = 'bad'
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(wrap.querySelector('.sui-input-error')).not.toBeNull()
    input.value = 'x@y.z'
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(wrap.querySelector('.sui-input-error')).toBeNull()
    expect(input.hasAttribute('aria-invalid')).toBe(false)
  })

  it('format sets HTML type when type unset', () => {
    const wrap = builtins.input({
      kind: 'input',
      name: 'e',
      label: 'E',
      format: 'email',
    })
    const input = wrap.querySelector('input') as HTMLInputElement
    expect(input.type).toBe('email')
  })
})

describe('textarea — validation', () => {
  it('shows error on blur when required and empty', () => {
    const wrap = builtins.textarea({
      kind: 'textarea',
      name: 'bio',
      label: 'Bio',
      validation: { required: true },
    })
    const ta = wrap.querySelector('textarea') as HTMLTextAreaElement
    ta.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(ta.getAttribute('aria-invalid')).toBe('true')
    expect(wrap.querySelector('.sui-input-error')?.textContent).toBe('This field is required')
  })
})
