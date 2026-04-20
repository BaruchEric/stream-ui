# User Input Round-trip & Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the human → agent loop (form submits and button clicks POST back to the agent) and add declarative validation + display masking to inputs.

**Architecture:** Add a pure `src/validation.ts` module (`validate()`, `applyMask()`). Extend input/textarea/form specs with `format` and `validation` fields. Client keeps a `messages[]` history in localStorage and sends it on every agent call. Server accepts `{ messages }` (legacy `{ prompt }` still works), translates to `CoreMessage[]` for `streamText`.

**Tech Stack:** TypeScript strict · Vitest + happy-dom · `ai` SDK · bun

**Spec:** `docs/superpowers/specs/2026-04-19-user-input-and-validation-design.md`

---

## File Structure

**Create:**
- `src/validation.ts` — pure `validate()` + `applyMask()` + format preset table
- `src/validation.test.ts` — unit tests for validation + masking

**Modify:**
- `src/types.ts` — add `InputFormat`, `ValidationRules`; extend `input` / `textarea` / `FormField`
- `src/components.ts` — blur validation, error DOM, mask binding in `input`; blur validation in `textarea`; submit validation in `form`
- `src/components.test.ts` — tests for validated input, masked input, form submit-gating
- `src/styles.css` — `[aria-invalid]` border, `.sui-input-error` span
- `src/index.ts` — re-export validation types + helpers
- `playground/server.ts` — accept `{messages}` body, `toCoreMessages()`, updated system prompt
- `playground/main.ts` — `messages[]` state, localStorage, `runAgent()` helper, rewired `onAction`, Clear button handler
- `playground/index.html` — Clear button in chat header

---

## Task 1: Add InputFormat and ValidationRules types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Open `src/types.ts` and add types**

Insert after the `InputType` type (around line 7):

```ts
export type InputFormat = 'email' | 'phone' | 'url' | 'zip' | 'credit-card'

export type ValidationRules = {
  required?: boolean
  pattern?: string
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  errorMessage?: string
}
```

- [ ] **Step 2: Extend FormField**

Replace the existing `FormField` type:

```ts
export type FormField = {
  name: string
  label: string
  type: InputType
  placeholder?: string
  format?: InputFormat
  validation?: ValidationRules
}
```

- [ ] **Step 3: Extend input spec**

Replace the `input` variant in the `ComponentSpec` union:

```ts
  | {
      kind: 'input'
      name: string
      label: string
      type?: InputType
      placeholder?: string
      value?: string
      action?: string
      format?: InputFormat
      validation?: ValidationRules
    }
```

- [ ] **Step 4: Extend textarea spec**

Replace the `textarea` variant in the `ComponentSpec` union:

```ts
  | {
      kind: 'textarea'
      name: string
      label: string
      placeholder?: string
      rows?: number
      value?: string
      action?: string
      validation?: ValidationRules
    }
```

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: PASS, no errors

- [ ] **Step 6: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add InputFormat and ValidationRules"
```

---

## Task 2: validate() — primitives (required / length / range / pattern)

**Files:**
- Create: `src/validation.ts`
- Create: `src/validation.test.ts`

- [ ] **Step 1: Write failing tests for primitives**

Create `src/validation.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `bun run test src/validation.test.ts`
Expected: FAIL — "Cannot find module './validation'"

- [ ] **Step 3: Implement validate() primitives**

Create `src/validation.ts`:

```ts
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
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `bun run test src/validation.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/validation.ts src/validation.test.ts
git commit -m "feat(validation): validate() primitives (required, length, range, pattern)"
```

---

## Task 3: validate() — format presets (email, phone, url, zip, credit-card)

**Files:**
- Modify: `src/validation.ts`
- Modify: `src/validation.test.ts`

- [ ] **Step 1: Add format tests**

Append to `src/validation.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `bun run test src/validation.test.ts`
Expected: FAIL — format cases return null but should return errors

- [ ] **Step 3: Implement format presets**

Replace the contents of `src/validation.ts`:

```ts
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
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `bun run test src/validation.test.ts`
Expected: PASS (14 tests: 7 primitives + 7 formats)

- [ ] **Step 5: Commit**

```bash
git add src/validation.ts src/validation.test.ts
git commit -m "feat(validation): format presets (email, phone, url, zip, credit-card)"
```

---

## Task 4: applyMask() for phone / zip / credit-card

**Files:**
- Modify: `src/validation.ts`
- Modify: `src/validation.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/validation.test.ts`:

```ts
import { applyMask } from './validation'

describe('applyMask', () => {
  it('phone — progressive', () => {
    expect(applyMask('', 'phone')).toBe('')
    expect(applyMask('5', 'phone')).toBe('(5')
    expect(applyMask('555', 'phone')).toBe('(555')
    expect(applyMask('5551', 'phone')).toBe('(555) 1')
    expect(applyMask('555123', 'phone')).toBe('(555) 123')
    expect(applyMask('5551234', 'phone')).toBe('(555) 123-4')
    expect(applyMask('5551234567', 'phone')).toBe('(555) 123-4567')
  })

  it('phone — strips non-digits and truncates at 10', () => {
    expect(applyMask('(555) 123-4567', 'phone')).toBe('(555) 123-4567')
    expect(applyMask('555-abc-1234567890', 'phone')).toBe('(555) 123-4567')
  })

  it('zip — 5 or 9 digits with dash', () => {
    expect(applyMask('1234', 'zip')).toBe('1234')
    expect(applyMask('12345', 'zip')).toBe('12345')
    expect(applyMask('123456', 'zip')).toBe('12345-6')
    expect(applyMask('123456789', 'zip')).toBe('12345-6789')
    expect(applyMask('1234567890123', 'zip')).toBe('12345-6789')
  })

  it('credit-card — groups of 4', () => {
    expect(applyMask('4111', 'credit-card')).toBe('4111')
    expect(applyMask('41111111', 'credit-card')).toBe('4111 1111')
    expect(applyMask('4111111111111111', 'credit-card')).toBe('4111 1111 1111 1111')
    expect(applyMask('4111-1111-1111-1111', 'credit-card')).toBe('4111 1111 1111 1111')
  })

  it('no-op for unmasked formats', () => {
    expect(applyMask('x@y.z', 'email')).toBe('x@y.z')
    expect(applyMask('https://x', 'url')).toBe('https://x')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `bun run test src/validation.test.ts`
Expected: FAIL — `applyMask` not exported

- [ ] **Step 3: Implement applyMask()**

Append to `src/validation.ts`:

```ts
export function applyMask(value: string, format: InputFormat): string {
  const digits = value.replace(/\D/g, '')
  switch (format) {
    case 'phone': {
      const d = digits.slice(0, 10)
      if (d.length === 0) return ''
      if (d.length <= 3) return `(${d}`
      if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    }
    case 'zip': {
      const d = digits.slice(0, 9)
      if (d.length <= 5) return d
      return `${d.slice(0, 5)}-${d.slice(5)}`
    }
    case 'credit-card': {
      const d = digits.slice(0, 19)
      return d.replace(/(.{4})/g, '$1 ').trim()
    }
    default:
      return value
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `bun run test src/validation.test.ts`
Expected: PASS (all 19 tests)

- [ ] **Step 5: Commit**

```bash
git add src/validation.ts src/validation.test.ts
git commit -m "feat(validation): applyMask for phone, zip, credit-card"
```

---

## Task 5: Wire validation + mask into input renderer

**Files:**
- Modify: `src/components.ts`
- Modify: `src/components.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/components.test.ts`:

```ts
import { builtins } from './components'

describe('input — validation + mask', () => {
  it('applies mask on input event', () => {
    const wrap = builtins.input({
      kind: 'input',
      name: 'phone',
      label: 'Phone',
      format: 'phone',
    })
    const input = wrap.querySelector('input') as HTMLInputElement
    input.value = '5551234567'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(input.value).toBe('(555) 123-4567')
  })

  it('shows error on blur when invalid', () => {
    const wrap = builtins.input({
      kind: 'input',
      name: 'email',
      label: 'Email',
      format: 'email',
      validation: { required: true },
    })
    const input = wrap.querySelector('input') as HTMLInputElement
    input.value = 'not-an-email'
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const err = wrap.querySelector('.sui-input-error')
    expect(err?.textContent).toBe('Enter a valid email')
  })

  it('clears error when value becomes valid', () => {
    const wrap = builtins.input({
      kind: 'input',
      name: 'email',
      label: 'Email',
      format: 'email',
    })
    const input = wrap.querySelector('input') as HTMLInputElement
    input.value = 'bad'
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(wrap.querySelector('.sui-input-error')).not.toBeNull()
    input.value = 'x@y.z'
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(wrap.querySelector('.sui-input-error')).toBeNull()
    expect(input.hasAttribute('aria-invalid')).toBe(false)
  })

  it('format sets HTML type when type unset', () => {
    const wrap = builtins.input({
      kind: 'input',
      name: 'e',
      label: 'E',
      format: 'email',
    })
    const input = wrap.querySelector('input') as HTMLInputElement
    expect(input.type).toBe('email')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `bun run test src/components.test.ts`
Expected: FAIL — no mask, no validation error element

- [ ] **Step 3: Implement in components.ts**

At the top of `src/components.ts`, add the import:

```ts
import { applyMask, validate } from './validation'
import type { InputFormat, ValidationRules } from './types'
```

Replace the existing `input:` renderer (currently at `src/components.ts:219-233`) with:

```ts
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
```

Add these helpers near the top of the file, below `createLabeledControl`:

```ts
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
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `bun run test src/components.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components.ts src/components.test.ts
git commit -m "feat(input): wire validation and display masking"
```

---

## Task 6: Wire validation into textarea renderer

**Files:**
- Modify: `src/components.ts`
- Modify: `src/components.test.ts`

- [ ] **Step 1: Write failing test**

Append to `src/components.test.ts`:

```ts
describe('textarea — validation', () => {
  it('shows error on blur when required and empty', () => {
    const wrap = builtins.textarea({
      kind: 'textarea',
      name: 'bio',
      label: 'Bio',
      validation: { required: true },
    })
    const ta = wrap.querySelector('textarea') as HTMLTextAreaElement
    ta.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(ta.getAttribute('aria-invalid')).toBe('true')
    expect(wrap.querySelector('.sui-input-error')?.textContent).toBe('This field is required')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `bun run test src/components.test.ts`
Expected: FAIL

- [ ] **Step 3: Update textarea renderer**

Replace the existing `textarea:` renderer in `src/components.ts` with:

```ts
  textarea: (spec, onAction) => {
    const ta = document.createElement('textarea')
    ta.className = 'sui-textarea'
    ta.name = spec.name
    ta.rows = spec.rows ?? 4
    if (spec.placeholder) ta.placeholder = spec.placeholder
    if (spec.value !== undefined) ta.value = spec.value
    const wrap = createLabeledControl(spec.label, ta)
    bindValidation(ta, wrap, spec.validation, undefined)
    const action = spec.action
    if (action) {
      ta.addEventListener('input', () => {
        onAction?.({ action, payload: { name: spec.name, value: ta.value } })
      })
    }
    return wrap
  },
```

- [ ] **Step 4: Run test — verify it passes**

Run: `bun run test src/components.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components.ts src/components.test.ts
git commit -m "feat(textarea): blur validation"
```

---

## Task 7: Form submit-time validation + first-invalid focus

**Files:**
- Modify: `src/components.ts`
- Modify: `src/components.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/components.test.ts`:

```ts
describe('form — submit-time validation', () => {
  it('blocks submit when required field is empty', () => {
    const calls: unknown[] = []
    const form = builtins.form(
      {
        kind: 'form',
        submitLabel: 'Save',
        fields: [
          { name: 'name', label: 'Name', type: 'text', validation: { required: true } },
          { name: 'email', label: 'Email', type: 'email', format: 'email' },
        ],
      },
      (e) => calls.push(e),
    )
    document.body.appendChild(form)
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(calls).toHaveLength(0)
    const firstInput = form.querySelector('input[name="name"]') as HTMLInputElement
    expect(firstInput.getAttribute('aria-invalid')).toBe('true')
    form.remove()
  })

  it('fires action with payload when all fields valid', () => {
    const calls: unknown[] = []
    const form = builtins.form(
      {
        kind: 'form',
        submitLabel: 'Save',
        fields: [{ name: 'name', label: 'Name', type: 'text' }],
      },
      (e) => calls.push(e),
    )
    document.body.appendChild(form)
    ;(form.querySelector('input[name="name"]') as HTMLInputElement).value = 'Eric'
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(calls).toEqual([{ action: 'submit:Save', payload: { name: 'Eric' } }])
    form.remove()
  })

  it('focuses the first invalid field', () => {
    const form = builtins.form(
      {
        kind: 'form',
        submitLabel: 'Save',
        fields: [
          { name: 'a', label: 'A', type: 'text' },
          { name: 'b', label: 'B', type: 'text', validation: { required: true } },
        ],
      },
      () => {},
    )
    document.body.appendChild(form)
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    const b = form.querySelector('input[name="b"]') as HTMLInputElement
    expect(document.activeElement).toBe(b)
    form.remove()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `bun run test src/components.test.ts`
Expected: FAIL — form submits without validation

- [ ] **Step 3: Replace form renderer**

Replace the existing `form:` renderer in `src/components.ts` with:

```ts
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
      let firstInvalid: HTMLInputElement | null = null
      for (const field of spec.fields) {
        const input = el.querySelector(`input[name="${field.name}"]`) as HTMLInputElement | null
        if (!input) continue
        const msg = validate(input.value, field.validation, field.format)
        const wrap = input.closest('.sui-input-wrap') as HTMLElement | null
        if (wrap) {
          const existing = wrap.querySelector('.sui-input-error')
          if (msg) {
            input.setAttribute('aria-invalid', 'true')
            if (existing) existing.textContent = msg
            else {
              const errEl = document.createElement('span')
              errEl.className = 'sui-input-error'
              errEl.setAttribute('role', 'alert')
              errEl.textContent = msg
              wrap.appendChild(errEl)
            }
          } else {
            input.removeAttribute('aria-invalid')
            existing?.remove()
          }
        }
        if (msg && !firstInvalid) firstInvalid = input
      }
      if (firstInvalid) {
        firstInvalid.focus()
        return
      }
      const data = new FormData(el)
      const payload: Record<string, unknown> = {}
      for (const [k, v] of data.entries()) payload[k] = v
      onAction?.({ action: `submit:${spec.submitLabel}`, payload })
    })
    return el
  },
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `bun run test src/components.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components.ts src/components.test.ts
git commit -m "feat(form): submit-time validation blocks submit and focuses first invalid"
```

---

## Task 8: Error styling

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Append rules to `src/styles.css`**

Add at the end of the file:

```css
.sui-input[aria-invalid='true'],
.sui-textarea[aria-invalid='true'] {
  border-color: var(--sui-danger);
}

.sui-input-error {
  color: var(--sui-danger);
  font-size: 0.85em;
  margin-top: 0.25em;
  display: block;
}
```

- [ ] **Step 2: Sanity-check variable exists**

Run: `grep -n 'sui-danger' src/styles.css`
Expected: at least one prior use (variable is defined in the theme block). If missing, add `--sui-danger: #f87171;` to the `:root` block in the same file.

- [ ] **Step 3: Build**

Run: `bun run build`
Expected: success, `dist/styles.css` regenerated

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "style: invalid-input border and error-message span"
```

---

## Task 9: Re-export validation from the package entry

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add re-exports**

In `src/index.ts`, add (near the other type exports):

```ts
export { validate, applyMask } from './validation'
export type { InputFormat, ValidationRules } from './types'
```

- [ ] **Step 2: Typecheck + build**

Run: `bun run typecheck && bun run build`
Expected: both succeed

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "chore: export validate, applyMask, and validation types"
```

---

## Task 10: Server — accept messages[] body and update system prompt

**Files:**
- Modify: `playground/server.ts`

- [ ] **Step 1: Add Message + toCoreMessages**

Insert after the `componentSpecSchema` declaration in `playground/server.ts`:

```ts
type PlaygroundMessage =
  | { role: 'user'; kind: 'prompt'; text: string }
  | { role: 'user'; kind: 'form-submit'; name: string; fields: Record<string, unknown> }
  | { role: 'user'; kind: 'button-click'; action: string }
  | { role: 'assistant'; kind: 'thinking'; text: string }
  | { role: 'assistant'; kind: 'render' | 'append'; spec: unknown }

type CoreMessage = { role: 'user' | 'assistant'; content: string }

function toCoreMessages(messages: PlaygroundMessage[]): CoreMessage[] {
  return messages.map((m) => {
    if (m.role === 'user') {
      if (m.kind === 'prompt') return { role: 'user', content: m.text }
      if (m.kind === 'form-submit') {
        const body = Object.entries(m.fields)
          .map(([k, v]) => `${k}="${String(v)}"`)
          .join(' ')
        return { role: 'user', content: `[form submit: ${m.name}] ${body}` }
      }
      return { role: 'user', content: `[button clicked: ${m.action}]` }
    }
    if (m.kind === 'thinking') return { role: 'assistant', content: m.text }
    const tag = m.kind === 'render' ? '[render]' : '[append]'
    return { role: 'assistant', content: `${tag} ${JSON.stringify(m.spec)}` }
  })
}
```

- [ ] **Step 2: Extend the system prompt**

In the `systemPrompt` template literal, append these bullets to the end of the Guidelines list:

```
6. If the latest user message is "[form submit: <name>] key="value" ...", the user
   submitted form <name>. Acknowledge or advance — e.g. render_ui a success card.
7. If the latest user message is "[button clicked: <action>]", the user clicked a
   button with that action. Continue the flow accordingly.
```

- [ ] **Step 3: Replace handleAgent body-parse**

In `playground/server.ts`, replace everything inside `handleAgent` from the opening line up to (but **not** including) the line `const stream = new ReadableStream({` with:

```ts
async function handleAgent(req: Request): Promise<Response> {
  let messages: PlaygroundMessage[]
  try {
    const body = (await req.json()) as {
      prompt?: unknown
      messages?: unknown
    }
    if (Array.isArray(body.messages) && body.messages.length > 0) {
      messages = body.messages as PlaygroundMessage[]
    } else if (typeof body.prompt === 'string' && body.prompt.trim() !== '') {
      messages = [{ role: 'user', kind: 'prompt', text: body.prompt }]
    } else {
      return new Response('Missing prompt or messages', { status: 400 })
    }
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

```

(The old `prompt` variable is now gone; any later references inside `handleAgent` must be removed in Step 4.)

- [ ] **Step 4: Swap streamText input from prompt to messages**

In the `streamText({...})` call inside the stream's `start`, replace:

```ts
          system: systemPrompt,
          prompt,
```

with:

```ts
          system: systemPrompt,
          messages: toCoreMessages(messages),
```

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 6: Smoke-check the server boots**

Start: `bun run playground:server` (in a terminal)
In another: `curl -s http://localhost:3030/api/health`
Expected: `{"ok":true,"model":"anthropic/claude-sonnet-4-6","hasApiKey":true}`
Then Ctrl-C the server.

- [ ] **Step 7: Commit**

```bash
git add playground/server.ts
git commit -m "feat(playground/server): accept messages[] body and thread action events"
```

---

## Task 11: Frontend — messages state + localStorage

**Files:**
- Modify: `playground/main.ts`

- [ ] **Step 1: Add message types and storage helpers**

Insert after the `import` block in `playground/main.ts`:

```ts
type PlaygroundMessage =
  | { role: 'user'; kind: 'prompt'; text: string }
  | { role: 'user'; kind: 'form-submit'; name: string; fields: Record<string, unknown> }
  | { role: 'user'; kind: 'button-click'; action: string }
  | { role: 'assistant'; kind: 'thinking'; text: string }
  | { role: 'assistant'; kind: 'render' | 'append'; spec: ComponentSpec | AnySpec }

const STORAGE_KEY = 'sui:playground:messages'

function loadMessages(): PlaygroundMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as PlaygroundMessage[]) : []
  } catch {
    return []
  }
}

function saveMessages(messages: PlaygroundMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  } catch {
    // ignore quota errors
  }
}

const messages: PlaygroundMessage[] = loadMessages()

function addMessage(msg: PlaygroundMessage): void {
  messages.push(msg)
  saveMessages(messages)
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add playground/main.ts
git commit -m "feat(playground): message history backed by localStorage"
```

---

## Task 12: Frontend — runAgent() reads messages and streams

**Files:**
- Modify: `playground/main.ts`

- [ ] **Step 1: Update realAgent to accept messages**

Find `async function* realAgent(prompt: string)` in `playground/main.ts` and replace its signature + first `fetch` block with:

```ts
async function* realAgent(msgs: PlaygroundMessage[]): AsyncGenerator<AgentEvent> {
  let response: Response
  try {
    response = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs }),
    })
  } catch (err) {
    throw new Error(`network: ${err instanceof Error ? err.message : String(err)}`)
  }
```

Everything after that line stays the same.

- [ ] **Step 2: Extract a runAgent helper**

Above the `chatForm.addEventListener('submit', ...)` line, insert:

```ts
async function runAgent(): Promise<void> {
  chatInput.disabled = true
  sendBtn.disabled = true
  const runMock = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    const prompt = lastUser && lastUser.kind === 'prompt' ? lastUser.text : ''
    for await (const event of mockAgent(prompt)) {
      if (event.type === 'thinking') {
        pushAI(event.text, 'thinking')
        addMessage({ role: 'assistant', kind: 'thinking', text: event.text })
      } else if (event.type === 'render') {
        pushAI(`→ render ${event.spec.kind}`)
        render(event.spec, uiStage, onAction)
        addMessage({ role: 'assistant', kind: 'render', spec: event.spec })
      } else if (event.type === 'append') {
        pushAI(`→ append ${event.spec.kind}`)
        append(event.spec, uiStage, onAction)
        addMessage({ role: 'assistant', kind: 'append', spec: event.spec })
      }
    }
  }

  try {
    if (realAvailable) {
      try {
        for await (const event of realAgent(messages)) {
          if (event.type === 'thinking') {
            pushAI(event.text, 'thinking')
            addMessage({ role: 'assistant', kind: 'thinking', text: event.text })
          } else if (event.type === 'render') {
            pushAI(`→ render ${event.spec.kind}`)
            render(event.spec, uiStage, onAction)
            addMessage({ role: 'assistant', kind: 'render', spec: event.spec })
          } else if (event.type === 'append') {
            pushAI(`→ append ${event.spec.kind}`)
            append(event.spec, uiStage, onAction)
            addMessage({ role: 'assistant', kind: 'append', spec: event.spec })
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (agentMode === 'llm') {
          pushAI(`agent error: ${msg}`, 'action')
          pushChat('system', `[llm error] ${msg}`)
        } else {
          pushAI(`agent unavailable (${msg}) — falling back to mock`, 'action')
          realAvailable = false
          await runMock()
        }
      }
    } else {
      await runMock()
    }
    pushChat('agent', 'Done.')
  } finally {
    chatInput.disabled = false
    sendBtn.disabled = false
    chatInput.focus()
  }
}
```

- [ ] **Step 3: Replace chatForm handler to use runAgent**

Replace the existing `chatForm.addEventListener('submit', ...)` handler with:

```ts
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const prompt = chatInput.value.trim()
  if (!prompt) return
  pushChat('human', prompt)
  chatInput.value = ''
  addMessage({ role: 'user', kind: 'prompt', text: prompt })
  await runAgent()
})
```

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add playground/main.ts
git commit -m "refactor(playground): runAgent() uses messages[] and streams responses"
```

---

## Task 13: Frontend — round-trip for form submits and button clicks

**Files:**
- Modify: `playground/main.ts`

- [ ] **Step 1: Replace onAction**

Replace the existing `const onAction = ...` declaration with:

```ts
const onAction: ActionHandler = (event: ActionEvent): void => {
  const payload = event.payload ? ` ${JSON.stringify(event.payload)}` : ''
  pushAI(`← UI action: ${event.action}${payload}`, 'action')
  pushChat('system', `[ui] ${event.action}${payload}`)

  if (event.action.startsWith('submit:')) {
    const formName = event.action.slice('submit:'.length)
    addMessage({
      role: 'user',
      kind: 'form-submit',
      name: formName,
      fields: (event.payload ?? {}) as Record<string, unknown>,
    })
    void runAgent()
    return
  }

  // Skip non-submit field-change actions — they're local state only.
  const p = event.payload as { name?: string; value?: unknown; checked?: unknown } | undefined
  const isFieldChange =
    typeof p?.name === 'string' && ('value' in (p ?? {}) || 'checked' in (p ?? {}))
  if (isFieldChange) return

  addMessage({ role: 'user', kind: 'button-click', action: event.action })
  void runAgent()
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add playground/main.ts
git commit -m "feat(playground): round-trip form submits and button clicks to agent"
```

---

## Task 14: Frontend — Clear button

**Files:**
- Modify: `playground/index.html`
- Modify: `playground/main.ts`
- Modify: `playground/style.css`

- [ ] **Step 1: Add Clear button to index.html**

Open `playground/index.html`, find the `<h2>CHAT</h2>` (or equivalent header) in the chat panel, and wrap it so we can add a button beside it. Change:

```html
<h2>CHAT</h2>
```

to:

```html
<div class="panel-header">
  <h2>CHAT</h2>
  <button type="button" id="chat-clear" class="panel-header-btn">Clear</button>
</div>
```

- [ ] **Step 2: Add minimal styling**

Append to `playground/style.css`:

```css
.panel-header { display: flex; align-items: center; justify-content: space-between; }
.panel-header-btn {
  background: transparent;
  color: var(--sui-fg, #ccc);
  border: 1px solid var(--sui-border, #444);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 0.75em;
  cursor: pointer;
}
.panel-header-btn:hover { background: rgba(255,255,255,0.05); }
```

- [ ] **Step 3: Wire Clear handler in main.ts**

Near the bottom of `playground/main.ts`, before the "Initial state" block, add:

```ts
const clearBtn = document.getElementById('chat-clear') as HTMLButtonElement | null
clearBtn?.addEventListener('click', () => {
  messages.length = 0
  saveMessages(messages)
  chatLog.innerHTML = ''
  aiStream.innerHTML = ''
  render(
    {
      kind: 'card',
      title: 'Welcome to stream-ui',
      body: 'Type a prompt in CHAT. Type "palette" to see every component at once.',
    },
    uiStage,
    onAction,
  )
  pushChat('system', 'session cleared')
  pushAI('Agent ready.')
})
```

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add playground/index.html playground/style.css playground/main.ts
git commit -m "feat(playground): Clear button resets conversation + UI"
```

---

## Task 15: End-to-end verification (manual)

**Files:** none (manual test)

- [ ] **Step 1: Start the full playground**

Run: `bun run playground:full`
Expected: server on :3030, vite on :5173, `hasApiKey: true`

- [ ] **Step 2: Render a validated form**

In the chat, type:

```
make a form with name (required), phone (format phone, required), email (format email)
```

Expected: form renders with three labeled inputs. The `phone` input shows `tel` keyboard on mobile.

- [ ] **Step 3: Verify mask**

Click the phone input. Type `5551234567`.
Expected: value displays as `(555) 123-4567`.

- [ ] **Step 4: Verify blur error**

Clear email, type `not-an-email`, tab out.
Expected: red border, `Enter a valid email` appears below the field.

- [ ] **Step 5: Verify submit gating**

Clear the name field, click Save.
Expected: name input gets red border + "required" error, focus lands on name. No new agent response in AI pane.

- [ ] **Step 6: Verify round-trip**

Fill all fields validly, click Save.
Expected:
- Chat pane shows `[ui] submit:Save {...}`
- AI pane shows thinking + a new render from the agent (confirmation card or summary)
- UI pane updates with the agent's response

- [ ] **Step 7: Verify button round-trip**

If the agent's response includes any buttons, click one.
Expected: chat shows `[ui] <action>`, agent responds with a follow-up render.

- [ ] **Step 8: Verify Clear button**

Click Clear.
Expected: chat log + AI pane empty, UI pane back to Welcome card. Reload the page — state stays cleared (localStorage empty).

- [ ] **Step 9: Verify reload persistence**

Run another round-trip (send a prompt, fill a form), then reload the page.
Expected: the UI pane redraws nothing (we don't restore the rendered specs yet — that's OK), but the `messages[]` in localStorage still carries history. Sending the next prompt produces a coherent agent response that references earlier turns.

- [ ] **Step 10: No commit needed — verification only**

If any step fails, open the relevant task, fix, re-run.

---

## Ship

After all tasks pass:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

All green, then push: `git push`

---

## Notes for the implementer

- **Tests use happy-dom** (configured in vitest.config — if there is none, `bun run test` already runs vitest; don't touch the config). If a test needs `document`, it's already available.
- **Don't import from `dist`** — always import from relative source paths (`./validation`, not `../dist/validation`).
- **Biome is the linter.** Run `bun run lint` after each task; Biome auto-fixable issues can be fixed with `bun run format`.
- **Keep tests colocated with source** in `src/` — that's the existing convention.
- **If a step's test file reference is outside `src/`**, you've gone off-plan.
