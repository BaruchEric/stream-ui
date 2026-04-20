import { describe, expect, it } from 'vitest'
import { validate } from './validation'

describe('validate — primitives', () => {
  it('returns null with no rules', () => {
    expect(validate('anything', undefined)).toBeNull()
    expect(validate('', {})).toBeNull()
  })

  it('required: rejects empty and whitespace-only', () => {
    expect(validate('', { required: true })).toBe('This field is required')
    expect(validate('   ', { required: true })).toBe('This field is required')
    expect(validate('x', { required: true })).toBeNull()
  })

  it('minLength / maxLength', () => {
    expect(validate('ab', { minLength: 3 })).toBe('Must be at least 3 characters')
    expect(validate('abcd', { maxLength: 3 })).toBe('Must be at most 3 characters')
    expect(validate('abc', { minLength: 3, maxLength: 3 })).toBeNull()
  })

  it('min / max on numeric values', () => {
    expect(validate('5', { min: 10 })).toBe('Must be at least 10')
    expect(validate('15', { max: 10 })).toBe('Must be at most 10')
    expect(validate('10', { min: 10, max: 10 })).toBeNull()
    expect(validate('abc', { min: 1 })).toBe('Must be a number')
  })

  it('pattern: custom regex', () => {
    expect(validate('abc', { pattern: '^[0-9]+$' })).toBe('Invalid format')
    expect(validate('123', { pattern: '^[0-9]+$' })).toBeNull()
  })

  it('errorMessage overrides default', () => {
    expect(validate('', { required: true, errorMessage: 'Need a value!' })).toBe('Need a value!')
    expect(validate('abc', { pattern: '^[0-9]+$', errorMessage: 'Digits only' })).toBe(
      'Digits only',
    )
  })

  it('skips non-required checks when value is empty', () => {
    expect(validate('', { minLength: 3 })).toBeNull()
    expect(validate('', { pattern: '^[0-9]+$' })).toBeNull()
  })
})

describe('validate — formats', () => {
  it('email', () => {
    expect(validate('x@y.z', undefined, 'email')).toBeNull()
    expect(validate('nope', undefined, 'email')).toBe('Enter a valid email')
    expect(validate('', undefined, 'email')).toBeNull()
  })

  it('phone (US)', () => {
    expect(validate('(555) 123-4567', undefined, 'phone')).toBeNull()
    expect(validate('555-1234', undefined, 'phone')).toBe('Enter a 10-digit phone')
  })

  it('url', () => {
    expect(validate('https://example.com', undefined, 'url')).toBeNull()
    expect(validate('http://x', undefined, 'url')).toBeNull()
    expect(validate('nope', undefined, 'url')).toBe('Enter a valid URL')
  })

  it('zip (5 or 9 digit)', () => {
    expect(validate('12345', undefined, 'zip')).toBeNull()
    expect(validate('12345-6789', undefined, 'zip')).toBeNull()
    expect(validate('1234', undefined, 'zip')).toBe('Enter a ZIP code')
  })

  it('credit-card (13-19 digits, allows spaces/dashes)', () => {
    expect(validate('4111 1111 1111 1111', undefined, 'credit-card')).toBeNull()
    expect(validate('4111-1111-1111-1111', undefined, 'credit-card')).toBeNull()
    expect(validate('4111111111', undefined, 'credit-card')).toBe('Enter a card number')
  })

  it('explicit pattern overrides format default', () => {
    expect(validate('12345', { pattern: '^\\d{4}$' }, 'phone')).toBe('Invalid format')
    expect(validate('1234', { pattern: '^\\d{4}$' }, 'phone')).toBeNull()
  })

  it('format + required', () => {
    expect(validate('', { required: true }, 'email')).toBe('This field is required')
    expect(validate('', { required: false }, 'email')).toBeNull()
  })
})
