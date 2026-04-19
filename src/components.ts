import type { ActionHandler, ComponentSpec } from './types'

export function createElement(spec: ComponentSpec, onAction?: ActionHandler): HTMLElement {
  switch (spec.kind) {
    case 'text': {
      const el = document.createElement('p')
      el.className = 'sui-text'
      el.textContent = spec.content
      return el
    }
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
    case 'button': {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'sui-button'
      el.textContent = spec.label
      el.addEventListener('click', () => onAction?.({ action: spec.action }))
      return el
    }
    case 'list': {
      const el = document.createElement('ul')
      el.className = 'sui-list'
      for (const item of spec.items) {
        const li = document.createElement('li')
        li.textContent = item
        el.appendChild(li)
      }
      return el
    }
    case 'form': {
      const el = document.createElement('form')
      el.className = 'sui-form'
      for (const field of spec.fields) {
        const wrap = document.createElement('label')
        wrap.className = 'sui-form-field'
        const labelText = document.createElement('span')
        labelText.textContent = field.label
        const input = document.createElement('input')
        input.name = field.name
        input.type = field.type
        if (field.placeholder) input.placeholder = field.placeholder
        wrap.append(labelText, input)
        el.appendChild(wrap)
      }
      const submit = document.createElement('button')
      submit.type = 'submit'
      submit.className = 'sui-button'
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
  }
}
