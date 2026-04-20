import { createElement } from './registry'
import { safeHref, safeImageSrc } from './safe-url'
import type { ComponentKind, InputFormat, Renderer, SpecOf, ValidationRules } from './types'
import { applyMask, validate } from './validation'

// Each built-in renderer is a pure function: spec + optional action handler
// → DOM element. Recursion (card/stack/row/grid → children) goes through
// `createElement` from the registry, so custom kinds nested inside built-in
// containers render correctly.
//
// Every entry below is callable on its own:
//   import { builtins } from 'stream-ui'
//   container.appendChild(builtins.button({ kind: 'button', label: 'Hi', action: 'x' }))
type BuiltinRenderers = { [K in ComponentKind]: Renderer<SpecOf<K>> }

// Wraps a form control in the standard `<label><span>text</span>…</label>`
// scaffold used by input/textarea/select.
function createLabeledControl(labelText: string, control: HTMLElement): HTMLLabelElement {
  const wrap = document.createElement('label')
  wrap.className = 'sui-input-wrap'
  const span = document.createElement('span')
  span.className = 'sui-input-label'
  span.textContent = labelText
  wrap.append(span, control)
  return wrap
}

const MASKED_FORMATS: ReadonlySet<InputFormat> = new Set(['phone', 'zip', 'credit-card'])

function formatToHtmlType(format: InputFormat | undefined): string | undefined {
  switch (format) {
    case 'email':
      return 'email'
    case 'phone':
      return 'tel'
    case 'url':
      return 'url'
    default:
      return undefined
  }
}

function bindMask(input: HTMLInputElement, format: InputFormat): void {
  input.addEventListener('input', () => {
    const masked = applyMask(input.value, format)
    if (masked !== input.value) input.value = masked
  })
}

function bindValidation(
  control: HTMLInputElement | HTMLTextAreaElement,
  wrap: HTMLElement,
  rules: ValidationRules | undefined,
  format: InputFormat | undefined,
): void {
  if (!rules && !format) return
  const show = (msg: string | null) => {
    const existing = wrap.querySelector('.sui-input-error')
    if (msg) {
      control.setAttribute('aria-invalid', 'true')
      if (existing) {
        existing.textContent = msg
      } else {
        const err = document.createElement('span')
        err.className = 'sui-input-error'
        err.setAttribute('role', 'alert')
        err.textContent = msg
        wrap.appendChild(err)
      }
    } else {
      control.removeAttribute('aria-invalid')
      existing?.remove()
    }
  }
  control.addEventListener('blur', () => {
    show(validate(control.value, rules, format))
  })
}

export const builtins: BuiltinRenderers = {
  // ─── display ────────────────────────────────────────────────────────
  text: (spec) => {
    const el = document.createElement('p')
    el.className = 'sui-text'
    el.textContent = spec.content
    return el
  },

  heading: (spec) => {
    const level = spec.level ?? 2
    const el = document.createElement(`h${level}`) as HTMLHeadingElement
    el.className = `sui-heading sui-heading-${level}`
    el.textContent = spec.content
    return el
  },

  paragraph: (spec) => {
    const el = document.createElement('p')
    el.className = 'sui-paragraph'
    el.textContent = spec.content
    return el
  },

  code: (spec) => {
    const el = document.createElement('code')
    el.className = `sui-code${spec.language ? ` sui-code-${spec.language}` : ''}`
    el.textContent = spec.content
    return el
  },

  divider: () => {
    const el = document.createElement('hr')
    el.className = 'sui-divider'
    return el
  },

  image: (spec) => {
    const el = document.createElement('img')
    el.className = 'sui-image'
    el.src = safeImageSrc(spec.src)
    el.alt = spec.alt
    if (spec.width) el.width = spec.width
    if (spec.height) el.height = spec.height
    return el
  },

  // ─── container & layout (recurse via registry) ──────────────────────
  card: (spec, onAction) => {
    const el = document.createElement('article')
    el.className = 'sui-card'
    const h = document.createElement('h3')
    h.textContent = spec.title
    el.appendChild(h)
    if (spec.body) {
      const p = document.createElement('p')
      p.textContent = spec.body
      el.appendChild(p)
    }
    if (spec.children) {
      for (const child of spec.children) {
        el.appendChild(createElement(child, onAction))
      }
    }
    return el
  },

  stack: (spec, onAction) => {
    const el = document.createElement('div')
    el.className = `sui-stack sui-gap-${spec.gap ?? 'md'}`
    for (const child of spec.children) {
      el.appendChild(createElement(child, onAction))
    }
    return el
  },

  row: (spec, onAction) => {
    const el = document.createElement('div')
    el.className = `sui-row sui-gap-${spec.gap ?? 'md'} sui-align-${spec.align ?? 'start'}`
    for (const child of spec.children) {
      el.appendChild(createElement(child, onAction))
    }
    return el
  },

  grid: (spec, onAction) => {
    const el = document.createElement('div')
    el.className = `sui-grid sui-gap-${spec.gap ?? 'md'}`
    el.style.setProperty('--sui-grid-cols', String(spec.columns ?? 2))
    for (const child of spec.children) {
      el.appendChild(createElement(child, onAction))
    }
    return el
  },

  // ─── feedback ───────────────────────────────────────────────────────
  alert: (spec) => {
    const el = document.createElement('div')
    const variant = spec.variant ?? 'info'
    el.className = `sui-alert sui-alert-${variant}`
    el.setAttribute('role', variant === 'error' ? 'alert' : 'status')
    el.textContent = spec.content
    return el
  },

  badge: (spec) => {
    const el = document.createElement('span')
    const variant = spec.variant ?? 'default'
    el.className = `sui-badge sui-badge-${variant}`
    el.textContent = spec.content
    return el
  },

  spinner: (spec) => {
    const el = document.createElement('div')
    el.className = 'sui-spinner'
    el.setAttribute('role', 'status')
    const circle = document.createElement('span')
    circle.className = 'sui-spinner-circle'
    el.appendChild(circle)
    if (spec.label) {
      const lbl = document.createElement('span')
      lbl.className = 'sui-spinner-label'
      lbl.textContent = spec.label
      el.appendChild(lbl)
    }
    return el
  },

  progress: (spec) => {
    const el = document.createElement('div')
    el.className = 'sui-progress'
    el.setAttribute('role', 'progressbar')
    const max = spec.max ?? 100
    const pct = Math.max(0, Math.min(100, (spec.value / max) * 100))
    el.setAttribute('aria-valuenow', String(spec.value))
    el.setAttribute('aria-valuemax', String(max))
    const track = document.createElement('div')
    track.className = 'sui-progress-track'
    const fill = document.createElement('div')
    fill.className = 'sui-progress-fill'
    fill.style.width = `${pct}%`
    track.appendChild(fill)
    el.appendChild(track)
    if (spec.label) {
      const lbl = document.createElement('span')
      lbl.className = 'sui-progress-label'
      lbl.textContent = `${spec.label} — ${Math.round(pct)}%`
      el.appendChild(lbl)
    }
    return el
  },

  // ─── data ───────────────────────────────────────────────────────────
  list: (spec) => {
    const el = document.createElement(spec.ordered ? 'ol' : 'ul')
    el.className = 'sui-list'
    for (const item of spec.items) {
      const li = document.createElement('li')
      li.textContent = item
      el.appendChild(li)
    }
    return el
  },

  table: (spec) => {
    const el = document.createElement('table')
    el.className = 'sui-table'
    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    for (const h of spec.headers) {
      const th = document.createElement('th')
      th.textContent = h
      headerRow.appendChild(th)
    }
    thead.appendChild(headerRow)
    el.appendChild(thead)
    const tbody = document.createElement('tbody')
    for (const row of spec.rows) {
      const tr = document.createElement('tr')
      for (const cell of row) {
        const td = document.createElement('td')
        td.textContent = cell
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    }
    el.appendChild(tbody)
    return el
  },

  // ─── input ──────────────────────────────────────────────────────────
  input: (spec, onAction) => {
    const input = document.createElement('input')
    input.className = 'sui-input'
    input.name = spec.name
    input.type = spec.type ?? formatToHtmlType(spec.format) ?? 'text'
    if (spec.placeholder) input.placeholder = spec.placeholder
    if (spec.value !== undefined) input.value = spec.value
    const wrap = createLabeledControl(spec.label, input)
    const format = spec.format
    const rules = spec.validation
    bindValidation(input, wrap, rules, format)
    if (format && MASKED_FORMATS.has(format)) bindMask(input, format)
    const action = spec.action
    if (action) {
      input.addEventListener('input', () => {
        onAction?.({ action, payload: { name: spec.name, value: input.value } })
      })
    }
    return wrap
  },

  textarea: (spec, onAction) => {
    const ta = document.createElement('textarea')
    ta.className = 'sui-textarea'
    ta.name = spec.name
    ta.rows = spec.rows ?? 4
    if (spec.placeholder) ta.placeholder = spec.placeholder
    if (spec.value !== undefined) ta.value = spec.value
    const action = spec.action
    if (action) {
      ta.addEventListener('input', () => {
        onAction?.({ action, payload: { name: spec.name, value: ta.value } })
      })
    }
    return createLabeledControl(spec.label, ta)
  },

  select: (spec, onAction) => {
    const sel = document.createElement('select')
    sel.className = 'sui-select'
    sel.name = spec.name
    for (const opt of spec.options) {
      const o = document.createElement('option')
      o.value = opt.value
      o.textContent = opt.label
      if (spec.value === opt.value) o.selected = true
      sel.appendChild(o)
    }
    const action = spec.action
    if (action) {
      sel.addEventListener('change', () => {
        onAction?.({ action, payload: { name: spec.name, value: sel.value } })
      })
    }
    return createLabeledControl(spec.label, sel)
  },

  checkbox: (spec, onAction) => {
    const wrap = document.createElement('label')
    wrap.className = 'sui-checkbox-wrap'
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.className = 'sui-checkbox'
    cb.name = spec.name
    if (spec.checked) cb.checked = true
    const labelText = document.createElement('span')
    labelText.className = 'sui-checkbox-label'
    labelText.textContent = spec.label
    const action = spec.action
    if (action) {
      cb.addEventListener('change', () => {
        onAction?.({ action, payload: { name: spec.name, checked: cb.checked } })
      })
    }
    wrap.append(cb, labelText)
    return wrap
  },

  form: (spec, onAction) => {
    const el = document.createElement('form')
    el.className = 'sui-form'
    for (const field of spec.fields) {
      el.appendChild(builtins.input({ kind: 'input', ...field }, onAction))
    }
    const submit = document.createElement('button')
    submit.type = 'submit'
    submit.className = 'sui-button sui-button-primary'
    submit.textContent = spec.submitLabel
    el.appendChild(submit)
    el.addEventListener('submit', (e) => {
      e.preventDefault()
      const data = new FormData(el)
      const payload: Record<string, unknown> = {}
      for (const [k, v] of data.entries()) payload[k] = v
      onAction?.({ action: `submit:${spec.submitLabel}`, payload })
    })
    return el
  },

  // ─── action ─────────────────────────────────────────────────────────
  button: (spec, onAction) => {
    const el = document.createElement('button')
    el.type = 'button'
    const variant = spec.variant ?? 'default'
    el.className = `sui-button sui-button-${variant}`
    el.textContent = spec.label
    el.addEventListener('click', () => onAction?.({ action: spec.action }))
    return el
  },

  link: (spec) => {
    const el = document.createElement('a')
    el.className = 'sui-link'
    const safe = safeHref(spec.href)
    el.href = safe
    el.textContent = spec.label
    if (/^(https?:)?\/\//.test(safe)) {
      el.target = '_blank'
      el.rel = 'noopener noreferrer'
    }
    return el
  },
}
