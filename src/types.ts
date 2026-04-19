export type AlertVariant = 'info' | 'success' | 'warning' | 'error'
export type BadgeVariant = 'default' | 'success' | 'warning' | 'error'
export type ButtonVariant = 'default' | 'primary' | 'danger'
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6
export type InputType = 'text' | 'number' | 'email' | 'password' | 'url' | 'tel' | 'search'

export type FormField = {
  name: string
  label: string
  type: InputType
  placeholder?: string
}

export type SelectOption = {
  value: string
  label: string
}

export type ComponentSpec =
  // ─── display ──────────────────────────────────────────────────────────
  | { kind: 'text'; content: string }
  | { kind: 'heading'; level?: HeadingLevel; content: string }
  | { kind: 'paragraph'; content: string }
  | { kind: 'code'; content: string; language?: string }
  | { kind: 'divider' }
  | { kind: 'image'; src: string; alt: string; width?: number; height?: number }
  // ─── container ────────────────────────────────────────────────────────
  | { kind: 'card'; title: string; body: string }
  // ─── feedback ─────────────────────────────────────────────────────────
  | { kind: 'alert'; variant?: AlertVariant; content: string }
  | { kind: 'badge'; content: string; variant?: BadgeVariant }
  | { kind: 'spinner'; label?: string }
  | { kind: 'progress'; value: number; max?: number; label?: string }
  // ─── data ─────────────────────────────────────────────────────────────
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  // ─── input ────────────────────────────────────────────────────────────
  | {
      kind: 'input'
      name: string
      label: string
      type?: InputType
      placeholder?: string
      value?: string
      action?: string
    }
  | {
      kind: 'textarea'
      name: string
      label: string
      placeholder?: string
      rows?: number
      value?: string
      action?: string
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
  // ─── action ───────────────────────────────────────────────────────────
  | { kind: 'button'; label: string; action: string; variant?: ButtonVariant }
  | { kind: 'link'; label: string; href: string }

export type ComponentKind = ComponentSpec['kind']

export type ActionEvent = {
  action: string
  payload?: Record<string, unknown>
}

export type ActionHandler = (event: ActionEvent) => void

export type AgentEvent =
  | { type: 'thinking'; text: string }
  | { type: 'render'; spec: ComponentSpec }
  | { type: 'append'; spec: ComponentSpec }
  | { type: 'done' }
