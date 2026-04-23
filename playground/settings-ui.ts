import {
  LAYOUT_PRESETS,
  type LayoutPreset,
  MODEL_PRESETS,
  THEME_PRESETS,
  type ThemePreset,
  clearSizes,
  readSettings,
  writeSettings,
} from './settings'

export type PopoverCallbacks = {
  onLayoutChange: () => void
  onThemeChange: (theme: ThemePreset) => void
  onLogout: () => void
}

const PRESET_LABELS: Record<LayoutPreset, string> = {
  default: 'Default',
  sideBySide: 'Side-by-side',
  stacked: 'Stacked',
}

const THEME_LABELS: Record<ThemePreset, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
  heritage: 'Heritage',
}

export function mountSettingsPopover(
  btn: HTMLButtonElement,
  popover: HTMLDivElement,
  cb: PopoverCallbacks,
): void {
  render()

  btn.addEventListener('click', () => {
    const open = popover.hasAttribute('hidden')
    if (open) show()
    else hide()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !popover.hasAttribute('hidden')) hide()
  })

  document.addEventListener('pointerdown', (e) => {
    if (popover.hasAttribute('hidden')) return
    const target = e.target as Node
    if (popover.contains(target) || btn.contains(target)) return
    hide()
  })

  function show() {
    render()
    popover.removeAttribute('hidden')
    btn.setAttribute('aria-expanded', 'true')
  }

  function hide() {
    popover.setAttribute('hidden', '')
    btn.setAttribute('aria-expanded', 'false')
  }

  function render() {
    const s = readSettings()
    const isCustomModel = !MODEL_PRESETS.includes(s.model)
    popover.replaceChildren(
      section('Theme', [themeRow(s.theme)]),
      section('Model', [
        modelSelect(s.model, isCustomModel),
        customModelInput(s.model, isCustomModel),
      ]),
      section('Layout', [presetRow(s.layout), hideAIRow(s.hideAI), resetSizesRow(s.layout)]),
      section('Account', [logoutRow()]),
    )
  }

  function toggleGroup<T extends string>(opts: {
    wrapClass: string
    wrapRole: string
    wrapLabel?: string
    buttonClass?: string
    buttonRole?: string
    values: readonly T[]
    labels: Record<T, string>
    current: T
    onPick: (value: T) => void
  }): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = opts.wrapClass
    wrap.setAttribute('role', opts.wrapRole)
    if (opts.wrapLabel) wrap.setAttribute('aria-label', opts.wrapLabel)
    for (const v of opts.values) {
      const btn = document.createElement('button')
      btn.type = 'button'
      if (opts.buttonClass) btn.className = opts.buttonClass
      if (opts.buttonRole) btn.setAttribute('role', opts.buttonRole)
      btn.textContent = opts.labels[v]
      btn.setAttribute('aria-pressed', v === opts.current ? 'true' : 'false')
      btn.addEventListener('click', () => opts.onPick(v))
      wrap.appendChild(btn)
    }
    return wrap
  }

  function themeRow(current: ThemePreset): HTMLElement {
    return toggleGroup<ThemePreset>({
      wrapClass: 'settings-theme-row',
      wrapRole: 'group',
      wrapLabel: 'Theme',
      buttonClass: 'settings-theme-btn',
      values: THEME_PRESETS,
      labels: THEME_LABELS,
      current,
      onPick: (t) => {
        writeSettings({ theme: t })
        cb.onThemeChange(t)
        render()
      },
    })
  }

  function section(title: string, children: HTMLElement[]): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'settings-section'
    const h = document.createElement('h3')
    h.textContent = title
    wrap.append(h, ...children)
    return wrap
  }

  function modelSelect(current: string, isCustom: boolean): HTMLElement {
    const sel = document.createElement('select')
    for (const m of MODEL_PRESETS) {
      const opt = document.createElement('option')
      opt.value = m
      opt.textContent = m
      if (!isCustom && m === current) opt.selected = true
      sel.appendChild(opt)
    }
    const customOpt = document.createElement('option')
    customOpt.value = '__custom__'
    customOpt.textContent = 'Custom…'
    if (isCustom) customOpt.selected = true
    sel.appendChild(customOpt)

    sel.addEventListener('change', () => {
      if (sel.value === '__custom__') {
        writeSettings({ model: current || '' })
      } else {
        writeSettings({ model: sel.value })
      }
      render()
    })
    return sel
  }

  function customModelInput(current: string, isCustom: boolean): HTMLElement {
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'provider/model-slug'
    input.value = isCustom ? current : ''
    input.hidden = !isCustom
    // Persist on blur or Enter so we don't write to localStorage per keystroke
    // (which also mid-typing leaves invalid partial slugs like 'ant' in storage).
    const commit = () => writeSettings({ model: input.value.trim() })
    input.addEventListener('blur', commit)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit()
    })
    return input
  }

  function presetRow(current: LayoutPreset): HTMLElement {
    return toggleGroup<LayoutPreset>({
      wrapClass: 'settings-layout-presets',
      wrapRole: 'radiogroup',
      buttonRole: 'radio',
      values: LAYOUT_PRESETS,
      labels: PRESET_LABELS,
      current,
      onPick: (p) => {
        writeSettings({ layout: p })
        render()
        cb.onLayoutChange()
      },
    })
  }

  function hideAIRow(current: boolean): HTMLElement {
    const label = document.createElement('label')
    label.className = 'settings-hide-ai-row'
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = current
    box.addEventListener('change', () => {
      writeSettings({ hideAI: box.checked })
      cb.onLayoutChange()
    })
    const text = document.createElement('span')
    text.textContent = 'Hide AI panel'
    label.append(box, text)
    return label
  }

  function resetSizesRow(active: LayoutPreset): HTMLElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = `Reset sizes (${PRESET_LABELS[active]})`
    b.addEventListener('click', () => {
      clearSizes(active)
      cb.onLayoutChange()
    })
    return b
  }

  function logoutRow(): HTMLElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'settings-logout'
    b.textContent = 'Log out'
    b.title = 'You may need to close this tab in some browsers'
    b.addEventListener('click', () => cb.onLogout())
    return b
  }
}
