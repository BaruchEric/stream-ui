import type { ActionHandler, ComponentSpec } from './types'

export function createElement(spec: ComponentSpec, onAction?: ActionHandler): HTMLElement {
  switch (spec.kind) {
    // ─── display ──────────────────────────────────────────────────────
    case 'text': {
      const el = document.createElement('p')
      el.className = 'sui-text'
      el.textContent = spec.content
      return el
    }

    case 'heading': {
      const level = spec.level ?? 2
      const el = document.createElement(`h${level}`) as HTMLHeadingElement
      el.className = `sui-heading sui-heading-${level}`
      el.textContent = spec.content
      return el
    }

    case 'paragraph': {
      const el = document.createElement('p')
      el.className = 'sui-paragraph'
      el.textContent = spec.content
      return el
    }

    case 'code': {
      const el = document.createElement('code')
      el.className = `sui-code${spec.language ? ` sui-code-${spec.language}` : ''}`
      el.textContent = spec.content
      return el
    }

    case 'divider': {
      const el = document.createElement('hr')
      el.className = 'sui-divider'
      return el
    }

    case 'image': {
      const el = document.createElement('img')
      el.className = 'sui-image'
      el.src = spec.src
      el.alt = spec.alt
      if (spec.width) el.width = spec.width
      if (spec.height) el.height = spec.height
      return el
    }

    // ─── container ────────────────────────────────────────────────────
    case 'card': {
      const el = document.createElement('article')
      el.className = 'sui-card'
      const h = document.createElement('h3')
      h.textContent = spec.title
      const p = document.createElement('p')
      p.textContent = spec.body
      el.append(h, p)
      return el
    }

    // ─── feedback ─────────────────────────────────────────────────────
    case 'alert': {
      const el = document.createElement('div')
      const variant = spec.variant ?? 'info'
      el.className = `sui-alert sui-alert-${variant}`
      el.setAttribute('role', variant === 'error' ? 'alert' : 'status')
      el.textContent = spec.content
      return el
    }

    case 'badge': {
      const el = document.createElement('span')
      const variant = spec.variant ?? 'default'
      el.className = `sui-badge sui-badge-${variant}`
      el.textContent = spec.content
      return el
    }

    case 'spinner': {
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
    }

    case 'progress': {
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
    }

    // ─── data ─────────────────────────────────────────────────────────
    case 'list': {
      const el = document.createElement(spec.ordered ? 'ol' : 'ul')
      el.className = 'sui-list'
      for (const item of spec.items) {
        const li = document.createElement('li')
        li.textContent = item
        el.appendChild(li)
      }
      return el
    }

    case 'table': {
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
    }

    // ─── input ────────────────────────────────────────────────────────
    case 'input': {
      const wrap = document.createElement('label')
      wrap.className = 'sui-input-wrap'
      const labelText = document.createElement('span')
      labelText.className = 'sui-input-label'
      labelText.textContent = spec.label
      const input = document.createElement('input')
      input.className = 'sui-input'
      input.name = spec.name
      input.type = spec.type ?? 'text'
      if (spec.placeholder) input.placeholder = spec.placeholder
      if (spec.value !== undefined) input.value = spec.value
      const action = spec.action
      if (action) {
        input.addEventListener('input', () => {
          onAction?.({ action, payload: { name: spec.name, value: input.value } })
        })
      }
      wrap.append(labelText, input)
      return wrap
    }

    case 'textarea': {
      const wrap = document.createElement('label')
      wrap.className = 'sui-input-wrap'
      const labelText = document.createElement('span')
      labelText.className = 'sui-input-label'
      labelText.textContent = spec.label
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
      wrap.append(labelText, ta)
      return wrap
    }

    case 'select': {
      const wrap = document.createElement('label')
      wrap.className = 'sui-input-wrap'
      const labelText = document.createElement('span')
      labelText.className = 'sui-input-label'
      labelText.textContent = spec.label
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
      wrap.append(labelText, sel)
      return wrap
    }

    case 'checkbox': {
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
    }

    case 'form': {
      const el = document.createElement('form')
      el.className = 'sui-form'
      for (const field of spec.fields) {
        const wrap = document.createElement('label')
        wrap.className = 'sui-input-wrap'
        const labelText = document.createElement('span')
        labelText.className = 'sui-input-label'
        labelText.textContent = field.label
        const input = document.createElement('input')
        input.className = 'sui-input'
        input.name = field.name
        input.type = field.type
        if (field.placeholder) input.placeholder = field.placeholder
        wrap.append(labelText, input)
        el.appendChild(wrap)
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
    }

    // ─── action ───────────────────────────────────────────────────────
    case 'button': {
      const el = document.createElement('button')
      el.type = 'button'
      const variant = spec.variant ?? 'default'
      el.className = `sui-button sui-button-${variant}`
      el.textContent = spec.label
      el.addEventListener('click', () => onAction?.({ action: spec.action }))
      return el
    }

    case 'link': {
      const el = document.createElement('a')
      el.className = 'sui-link'
      el.href = spec.href
      el.textContent = spec.label
      if (/^https?:\/\//.test(spec.href)) {
        el.target = '_blank'
        el.rel = 'noopener noreferrer'
      }
      return el
    }
  }
}
