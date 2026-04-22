import { describe, expect, test } from 'vitest'
import { DEFAULT_MODEL, resolveModel } from './model'

describe('resolveModel', () => {
  test('returns default when nothing supplied', () => {
    expect(resolveModel(undefined, {})).toBe(DEFAULT_MODEL)
  })

  test('uses AI_MODEL env when body model absent', () => {
    expect(resolveModel({}, { AI_MODEL: 'anthropic/claude-opus-4-7' })).toBe(
      'anthropic/claude-opus-4-7',
    )
  })

  test('accepts valid body.model over env', () => {
    expect(
      resolveModel({ model: 'openai/gpt-5' }, { AI_MODEL: 'anthropic/claude-sonnet-4-6' }),
    ).toBe('openai/gpt-5')
  })

  test('ignores empty string body.model', () => {
    expect(resolveModel({ model: '' }, { AI_MODEL: 'openai/gpt-4o' })).toBe('openai/gpt-4o')
  })

  test('rejects malformed slug (no slash)', () => {
    expect(resolveModel({ model: 'claude-sonnet-4-6' }, {})).toBe(DEFAULT_MODEL)
  })

  test('rejects slug with spaces or quotes', () => {
    expect(resolveModel({ model: 'anthropic/claude 4; drop table' }, {})).toBe(DEFAULT_MODEL)
  })

  test('accepts slug with dots, dashes, underscores', () => {
    expect(resolveModel({ model: 'vendor.x/my-model_v1.2' }, {})).toBe('vendor.x/my-model_v1.2')
  })
})
