// ─── shared variant tokens ──────────────────────────────────────────────
export type Gap = 'sm' | 'md' | 'lg'
export type AlertVariant = 'info' | 'success' | 'warning' | 'error'
export type BadgeVariant = 'default' | 'success' | 'warning' | 'error'
export type ButtonVariant = 'default' | 'primary' | 'danger'
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6
export type InputType = 'text' | 'number' | 'email' | 'password' | 'url' | 'tel' | 'search'

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

export type FormField = {
  name: string
  label: string
  type: InputType
  placeholder?: string
  format?: InputFormat
  validation?: ValidationRules
}

export type SelectOption = {
  value: string
  label: string
}

// ─── built-in component specs ───────────────────────────────────────────
// The agent (or any consumer) generates these as JSON; the framework
// renders them via registered renderers. New kinds can be added at runtime
// via `register(kind, renderer)`.
export type ComponentSpec =
  // display
  | { kind: 'text'; content: string }
  | { kind: 'heading'; level?: HeadingLevel; content: string }
  | { kind: 'paragraph'; content: string }
  | { kind: 'code'; content: string; language?: string }
  | { kind: 'divider' }
  | { kind: 'image'; src: string; alt: string; width?: number; height?: number }
  // container & layout
  | { kind: 'card'; title: string; body?: string; children?: ComponentSpec[] }
  | { kind: 'stack'; children: ComponentSpec[]; gap?: Gap }
  | { kind: 'row'; children: ComponentSpec[]; gap?: Gap; align?: 'start' | 'center' | 'end' }
  | { kind: 'grid'; children: ComponentSpec[]; columns?: number; gap?: Gap }
  // feedback
  | { kind: 'alert'; variant?: AlertVariant; content: string }
  | { kind: 'badge'; content: string; variant?: BadgeVariant }
  | { kind: 'spinner'; label?: string }
  | { kind: 'progress'; value: number; max?: number; label?: string }
  // data
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  // input
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
  | {
      kind: 'select'
      name: string
      label: string
      options: SelectOption[]
      value?: string
      action?: string
    }
  | { kind: 'checkbox'; name: string; label: string; checked?: boolean; action?: string }
  | { kind: 'form'; submitLabel: string; fields: FormField[] }
  // action
  | { kind: 'button'; label: string; action: string; variant?: ButtonVariant }
  | { kind: 'link'; label: string; href: string }

export type ComponentKind = ComponentSpec['kind']
export type SpecOf<K extends ComponentKind> = Extract<ComponentSpec, { kind: K }>

// ─── permissive shape for custom kinds registered at runtime ────────────
// Custom kinds use this shape — no compile-time discrimination, but
// fully renderable. The agent treats every spec as JSON anyway.
export type AnySpec = { kind: string; [key: string]: unknown }

// ─── renderer signature ─────────────────────────────────────────────────
// A renderer takes a spec and an optional action callback, returns a DOM
// element. That's it. No global state, no framework lifecycle — call them
// independently if you want.
export type Renderer<T = AnySpec> = (spec: T, onAction?: ActionHandler) => HTMLElement

// ─── action plumbing ────────────────────────────────────────────────────
export type ActionEvent = {
  action: string
  payload?: Record<string, unknown>
}

export type ActionHandler = (event: ActionEvent) => void

// ─── agent transport (optional helper type) ─────────────────────────────
export type AgentEvent =
  | { type: 'thinking'; text: string }
  | { type: 'render'; spec: ComponentSpec | AnySpec }
  | { type: 'append'; spec: ComponentSpec | AnySpec }
  | { type: 'done' }
