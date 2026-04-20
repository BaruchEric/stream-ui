# User Input Round-trip & Validation — Design

**Date:** 2026-04-19
**Status:** Approved design, pending implementation plan

## Goal

Close the human → agent loop: when a user submits a form or clicks an agent-rendered button, the submitted data / action flows back to the AI agent so it can continue the conversation. Along the way, inputs gain declarative validation (required, pattern, format) and display-time masking for formats like phone and ZIP.

## Motivation

Today `onAction` fires on form submit and button click, but nothing is sent to the server — the agent can't react. The playground demonstrates one-shot rendering only. To support multi-turn flows ("Here's a contact form" → user fills it → agent confirms with a summary card) we need a bidirectional message protocol, plus inputs that validate themselves so the agent doesn't have to defensively re-check every field.

## Scope

In:
- Message protocol change so actions round-trip to `/api/agent`
- Client-side conversation history persisted to localStorage
- `validation` + `format` fields on `input` / `textarea` / `form.fields` specs
- Blur-time + submit-time validation with inline error display
- Display masking for phone / ZIP / credit-card
- Unit tests for validation + masking; component tests for form flow
- Updated system prompt explaining action events

Out:
- Full cursor-aware mask editors
- Async / server-side validation
- Formats beyond the 5 below
- International phone / postal formats
- Server-side session storage

## Decisions (locked)

1. **Round-trip trigger:** form submits and button clicks only. Input / select / checkbox changes stay local.
2. **Conversation state:** client-side `messages[]`, persisted to `localStorage`. Server stays stateless.
3. **Validation API:** layered — declarative `format` presets on top of primitive rules (`required`, `pattern`, `minLength`, …). `format` sets defaults; explicit rules override.
4. **Masking:** enabled for `phone`, `zip`, `credit-card`. Naive append-only cursor handling (good enough for v1).

## Section 1 — Message protocol

Frontend maintains a typed message array:

```ts
type Message =
  | { role: 'user'; kind: 'prompt'; text: string }
  | { role: 'user'; kind: 'form-submit'; name: string; fields: Record<string, unknown> }
  | { role: 'user'; kind: 'button-click'; action: string }
  | { role: 'assistant'; kind: 'thinking'; text: string }
  | { role: 'assistant'; kind: 'render' | 'append'; spec: ComponentSpec }
```

Request body for `POST /api/agent` becomes `{ messages: Message[] }`. Back-compat: if body contains a `prompt` string instead, wrap it as a single `{ role: 'user', kind: 'prompt', text: prompt }` message.

Server-side translation to `CoreMessage[]` (AI SDK format):
- `user/prompt` → user message, content = `text`
- `user/form-submit` → user message, content = `` `[form submit: ${name}] ${Object.entries(fields).map(([k, v]) => `${k}="${v}"`).join(' ')}` ``
- `user/button-click` → user message, content = `` `[button clicked: ${action}]` ``
- `assistant/thinking` → assistant message, content = `text`
- `assistant/render` → assistant message, content = `` `[render] ${JSON.stringify(spec)}` ``
- `assistant/append` → assistant message, content = `` `[append] ${JSON.stringify(spec)}` ``

System prompt gets two additional lines:
- When you see `[form submit: X] key="value" …`, the user has just submitted form X; respond by rendering an acknowledgement or the next step.
- When you see `[button clicked: Y]`, the user clicked button Y; continue accordingly.

Tool-call plumbing (`render_ui` / `append_ui`) is unchanged — the SDK handles threading.

Storage: `localStorage['sui:playground:messages']` holds the full array, serialized JSON. A "Clear" button wipes it and re-renders the welcome card.

## Section 2 — Input spec changes

New types in `src/types.ts`:

```ts
type InputFormat = 'email' | 'phone' | 'url' | 'zip' | 'credit-card'

type ValidationRules = {
  required?: boolean
  pattern?: string       // regex source string
  minLength?: number
  maxLength?: number
  min?: number           // numeric inputs
  max?: number
  errorMessage?: string  // override default
}
```

Extended specs:
- `input` gains optional `format?: InputFormat`, `validation?: ValidationRules`
- `textarea` gains optional `validation?: ValidationRules` (no format — always free text)
- `FormField` mirrors the `input` additions

### Format preset table

| format       | HTML type | pattern (regex)                   | mask               | default error                |
|--------------|-----------|-----------------------------------|--------------------|------------------------------|
| email        | email     | `^[^\s@]+@[^\s@]+\.[^\s@]+$`     | —                  | "Enter a valid email"        |
| phone        | tel       | `^\(\d{3}\) \d{3}-\d{4}$`         | `(999) 999-9999`   | "Enter a 10-digit phone"     |
| url          | url       | `^https?://.+`                    | —                  | "Enter a valid URL"          |
| zip          | text      | `^\d{5}(-\d{4})?$`                | `99999[-9999]`     | "Enter a ZIP code"           |
| credit-card  | text      | `^\d{13,19}$` (on digits-only)    | `9999 9999 9999 9999` | "Enter a card number"    |

For `credit-card`, `validate()` strips non-digits from the input before testing the pattern. The masked display string (with spaces) is what gets passed to the agent on submit; the underlying validation is digits-only.

Explicit `validation.pattern` always overrides the format default. `required` is independent — a format without `required` is optional.

## Section 3 — Rendering & UX

**New module:** `src/validation.ts`

```ts
export function validate(
  value: string,
  rules: ValidationRules | undefined,
  format?: InputFormat,
): string | null            // returns error message, or null if valid

export function applyMask(value: string, format: InputFormat): string
```

Both pure functions; no DOM, no side effects. `applyMask` is a no-op for formats without a mask.

**Renderer changes** (`src/components.ts`, `input` / `textarea` / `form`):

- Input element attaches a `blur` listener: run `validate()`; if it returns an error, set `aria-invalid="true"` and render/update the sibling `<span class="sui-input-error">`; otherwise clear both.
- Masked formats attach an `input` listener that calls `applyMask()` and writes the result back to `element.value`. Cursor stays at the end (v1 constraint).
- `form` renderer collects fields on submit, validates each, blocks submit on any failure, focuses the first invalid field. On success, fires `onAction` with the payload (keys = `field.name`, values = the formatted string as displayed).

**Error DOM:** `<span class="sui-input-error" role="alert">{msg}</span>` appended inside `.sui-input-wrap` after the control. Exists only when there's a current error.

**Styles** (`src/styles.css`):
```css
.sui-input[aria-invalid="true"],
.sui-textarea[aria-invalid="true"] { border-color: var(--sui-danger); }
.sui-input-error { color: var(--sui-danger); font-size: 0.85em; margin-top: 0.25em; display: block; }
```

## Section 4 — Server & frontend wiring

### Server (`playground/server.ts`)

- `handleAgent` accepts `{ messages: Message[] }` or legacy `{ prompt: string }`. Build `CoreMessage[]` via new local helper `toCoreMessages(messages)`. Pass to `streamText` via `messages` (not `prompt`).
- System prompt string in the same file gains the two action-event bullets.
- Health endpoint unchanged.

### Frontend (`playground/main.ts`)

- New module-level `messages: Message[]`, loaded from localStorage at boot.
- `saveMessages()` and `addMessage()` helpers; every mutation persists.
- `runAgent()` replaces the inline loop: takes no args, reads current `messages[]`, POSTs them, streams the SSE response, appends assistant messages as they arrive.
- `chatForm` submit handler: add a `user/prompt` message, call `runAgent()`.
- `onAction` rewritten:
  - If `action` starts with `submit:` → add `user/form-submit` message, call `runAgent()`
  - Else (button click) → add `user/button-click` message, call `runAgent()`
  - Changes from non-submit inputs (select/checkbox/text typing) are **not** sent — they only live in the DOM until the containing form submits.
- Add a "Clear" button in the chat header that clears `messages[]`, localStorage, chat DOM, and re-renders the welcome card.

### Custom component (`kanban-card`) — no change

The existing registered custom kind has its own `action` click payload; it rides the same button-click round-trip path.

## Section 5 — Testing

### New file `src/validation.test.ts`

- `validate()` returns null for valid email / phone / url / zip / credit-card
- `validate()` returns correct error message for each format's invalid cases
- `required` rule: empty string returns error, whitespace-only returns error
- `minLength` / `maxLength` / `min` / `max` boundary cases
- Explicit `pattern` overrides format default
- `errorMessage` overrides default message
- `applyMask()`: progressive formatting for phone (`"5"` → `"(5"`, `"555"` → `"(555) "`, `"5551234"` → `"(555) 123-4"`, `"5551234567"` → `"(555) 123-4567"`); digits-only input; over-length truncation; non-digit characters stripped before masking; zip short / long forms; credit-card grouping

### Extend `src/components.test.ts`

- `input` with `format: 'phone'`: simulated `input` events apply mask; `blur` with invalid value shows error; subsequent valid value clears error and `aria-invalid`
- `form` with required field empty: `submit` is prevented, `onAction` is not called, first invalid field receives focus
- `form` with all fields valid: `onAction` fires with payload containing formatted values; error nodes removed
- Explicit `validation.pattern` overrides format default (custom 5-digit phone)

### Playground verification (manual via `preview_*`)

- Render form with name + phone + email, submit invalid phone → inline error, no agent message
- Submit valid payload → agent receives the submission and renders an acknowledgement card
- Click an agent-rendered button → agent receives the click and continues

### Out of scope

- Full cursor-position-aware mask editing
- Async / server-side validation
- Additional formats (SSN, IBAN, dates)
- Reset-on-success form behavior (agent re-renders if it wants a fresh form)

## File change summary

| File                                | Change                                           |
|-------------------------------------|--------------------------------------------------|
| `src/types.ts`                      | Add `InputFormat`, `ValidationRules`; extend `input` / `textarea` / `FormField` |
| `src/validation.ts`                 | **New** — pure `validate()` + `applyMask()`      |
| `src/components.ts`                 | Blur validation, error node, mask binding, form-submit validation |
| `src/styles.css`                    | `[aria-invalid="true"]` + `.sui-input-error`     |
| `src/index.ts`                      | Re-export validation types                       |
| `src/validation.test.ts`            | **New** — unit tests                             |
| `src/components.test.ts`            | New cases for validation + formats               |
| `playground/server.ts`              | `messages[]` body, `toCoreMessages()`, system prompt |
| `playground/main.ts`                | Client history + localStorage + round-trip wiring + Clear |
| `playground/index.html`             | Clear button in chat header                      |

## Risks

- **Mask cursor awkwardness:** users editing the middle of a phone number will have the cursor snap to end. Acceptable for v1 playground usage.
- **localStorage bloat:** long sessions produce large message arrays. Cap at ~500 messages or trim oldest first if we ever hit issues; not solving now.
- **Agent confusion from bracketed events:** if the model treats `[form submit: X]` as literal output instead of structured input, we may see weird replies. Mitigation: unambiguous system-prompt language + one demo in the prompt.
- **Back-compat for `prompt` body:** retaining the legacy shape means two code paths on the server. Worth it — lets external callers and any saved tests keep working.
