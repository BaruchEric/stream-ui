import type { InputFormat, ValidationRules } from './types'

export function validate(
  value: string,
  rules: ValidationRules | undefined,
  _format?: InputFormat,
): string | null {
  if (!rules) return null
  const { errorMessage } = rules

  if (rules.required && value.trim() === '') {
    return errorMessage ?? 'This field is required'
  }

  if (value === '') return null

  if (rules.minLength !== undefined && value.length < rules.minLength) {
    return errorMessage ?? `Must be at least ${rules.minLength} characters`
  }
  if (rules.maxLength !== undefined && value.length > rules.maxLength) {
    return errorMessage ?? `Must be at most ${rules.maxLength} characters`
  }

  if (rules.min !== undefined || rules.max !== undefined) {
    const n = Number(value)
    if (Number.isNaN(n)) return errorMessage ?? 'Must be a number'
    if (rules.min !== undefined && n < rules.min) {
      return errorMessage ?? `Must be at least ${rules.min}`
    }
    if (rules.max !== undefined && n > rules.max) {
      return errorMessage ?? `Must be at most ${rules.max}`
    }
  }

  if (rules.pattern !== undefined) {
    const re = new RegExp(rules.pattern)
    if (!re.test(value)) return errorMessage ?? 'Invalid format'
  }

  return null
}
