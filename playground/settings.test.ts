import { beforeEach, describe, expect, test } from 'vitest'
import { DEFAULT_MODEL, type LayoutPreset, readSettings, writeSettings } from './settings'

beforeEach(() => {
  localStorage.clear()
})

describe('readSettings', () => {
  test('returns defaults when localStorage is empty', () => {
    const s = readSettings()
    expect(s.model).toBe(DEFAULT_MODEL)
    expect(s.layout).toBe<LayoutPreset>('default')
    expect(s.hideAI).toBe(false)
    expect(s.sizes).toEqual({ default: {}, sideBySide: {}, stacked: {} })
  })

  test('round-trips written values', () => {
    writeSettings({ model: 'openai/gpt-5', layout: 'stacked', hideAI: true })
    const s = readSettings()
    expect(s.model).toBe('openai/gpt-5')
    expect(s.layout).toBe('stacked')
    expect(s.hideAI).toBe(true)
  })

  test('sizes are keyed per preset', () => {
    writeSettings({ sizes: { default: { 'chat-ai': 0.4 } } })
    writeSettings({ sizes: { sideBySide: { 'ai-ui': 0.5 } } })
    const s = readSettings()
    expect(s.sizes.default['chat-ai']).toBe(0.4)
    expect(s.sizes.sideBySide['ai-ui']).toBe(0.5)
    expect(s.sizes.stacked).toEqual({})
  })

  test('tolerates corrupt JSON in size keys', () => {
    localStorage.setItem('sui.layout.sizes.default', 'not-json{{{')
    const s = readSettings()
    expect(s.sizes.default).toEqual({})
  })

  test('unknown layout preset falls back to default', () => {
    localStorage.setItem('sui.layout.preset', 'wat')
    expect(readSettings().layout).toBe('default')
  })
})
