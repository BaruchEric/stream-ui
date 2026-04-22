export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-6'

export const MODEL_PRESETS: ReadonlyArray<string> = [
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-opus-4-7',
  'anthropic/claude-haiku-4-5',
  'openai/gpt-5',
  'openai/gpt-4o',
  'google/gemini-2.5-pro',
]

export type LayoutPreset = 'default' | 'sideBySide' | 'stacked'
export const LAYOUT_PRESETS: ReadonlyArray<LayoutPreset> = ['default', 'sideBySide', 'stacked']

export type ResizerPair = 'chat-ai' | 'ai-ui' | 'top-bottom'
export type SizeMap = Partial<Record<ResizerPair, number>>

export type SuiSettings = {
  model: string
  layout: LayoutPreset
  hideAI: boolean
  sizes: Record<LayoutPreset, SizeMap>
}

const KEY_MODEL = 'sui.model'
const KEY_LAYOUT = 'sui.layout.preset'
const KEY_HIDE_AI = 'sui.layout.hideAI'
const sizesKey = (p: LayoutPreset) => `sui.layout.sizes.${p}`

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as unknown
    return (parsed ?? fallback) as T
  } catch {
    return fallback
  }
}

function getItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function readSizeMap(preset: LayoutPreset): SizeMap {
  const raw = readJSON<unknown>(sizesKey(preset), {})
  if (!raw || typeof raw !== 'object') return {}
  const out: SizeMap = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if ((k === 'chat-ai' || k === 'ai-ui' || k === 'top-bottom') && typeof v === 'number') {
      out[k] = v
    }
  }
  return out
}

export function readSettings(): SuiSettings {
  const rawLayout = getItem(KEY_LAYOUT)
  const layout: LayoutPreset =
    rawLayout === 'default' || rawLayout === 'sideBySide' || rawLayout === 'stacked'
      ? rawLayout
      : 'default'
  return {
    model: getItem(KEY_MODEL) ?? DEFAULT_MODEL,
    layout,
    hideAI: getItem(KEY_HIDE_AI) === 'true',
    sizes: {
      default: readSizeMap('default'),
      sideBySide: readSizeMap('sideBySide'),
      stacked: readSizeMap('stacked'),
    },
  }
}

export type SettingsPatch = Partial<{
  model: string
  layout: LayoutPreset
  hideAI: boolean
  sizes: Partial<Record<LayoutPreset, SizeMap>>
}>

export function writeSettings(patch: SettingsPatch): void {
  try {
    if (patch.model !== undefined) localStorage.setItem(KEY_MODEL, patch.model)
    if (patch.layout !== undefined) localStorage.setItem(KEY_LAYOUT, patch.layout)
    if (patch.hideAI !== undefined) localStorage.setItem(KEY_HIDE_AI, String(patch.hideAI))
    if (patch.sizes !== undefined) {
      for (const [preset, map] of Object.entries(patch.sizes) as [LayoutPreset, SizeMap][]) {
        const existing = readSizeMap(preset)
        const merged = { ...existing, ...map }
        localStorage.setItem(sizesKey(preset), JSON.stringify(merged))
      }
    }
  } catch {
    // quota / disabled storage — best effort
  }
}

export function clearSizes(preset: LayoutPreset): void {
  try {
    localStorage.removeItem(sizesKey(preset))
  } catch {
    // ignore
  }
}
