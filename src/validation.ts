import type { InputFormat, ValidationRules } from './types'

type FormatPreset = {
  pattern: RegExp
  error: string
  strip?: (v: string) => string
}

const FORMAT_PRESETS: Record<InputFormat, FormatPreset> = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    error: 'Enter a valid email',
  },
  phone: {
    pattern: /^\(\d{3}\) \d{3}-\d{4}$/,
    error: 'Enter a 10-digit phone',
  },
  url: {
    pattern: /^https?:\/\/.+/,
    error: 'Enter a valid URL',
  },
  zip: {
    pattern: /^\d{5}(-\d{4})?$/,
    error: 'Enter a ZIP code',
  },
  'credit-card': {
    pattern: /^\d{13,19}$/,
    error: 'Enter a card number',
    strip: (v) => v.replace(/[\s-]/g, ''),
  },
}

export function validate(
  value: string,
  rules: ValidationRules | undefined,
  format?: InputFormat,
): string | null {
  const errorMessage = rules?.errorMessage

  if (rules?.required && value.trim() === '') {
    return errorMessage ?? 'This field is required'
  }

  if (value === '') return null

  if (rules?.minLength !== undefined && value.length < rules.minLength) {
    return errorMessage ?? `Must be at least ${rules.minLength} characters`
  }
  if (rules?.maxLength !== undefined && value.length > rules.maxLength) {
    return errorMessage ?? `Must be at most ${rules.maxLength} characters`
  }

  if (rules?.min !== undefined || rules?.max !== undefined) {
    const n = Number(value)
    if (Number.isNaN(n)) return errorMessage ?? 'Must be a number'
    if (rules.min !== undefined && n < rules.min) {
      return errorMessage ?? `Must be at least ${rules.min}`
    }
    if (rules.max !== undefined && n > rules.max) {
      return errorMessage ?? `Must be at most ${rules.max}`
    }
  }

  // Explicit pattern takes precedence over the format preset.
  if (rules?.pattern !== undefined) {
    if (!new RegExp(rules.pattern).test(value)) return errorMessage ?? 'Invalid format'
  } else if (format) {
    const preset = FORMAT_PRESETS[format]
    const candidate = preset.strip ? preset.strip(value) : value
    if (!preset.pattern.test(candidate)) return errorMessage ?? preset.error
  }

  return null
}
