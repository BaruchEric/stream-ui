export type ComponentSpec =
  | { kind: 'text'; content: string }
  | { kind: 'card'; title: string; body: string }
  | { kind: 'button'; label: string; action: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'form'; submitLabel: string; fields: FormField[] }

export type FormField = {
  name: string
  label: string
  type: 'text' | 'number' | 'email'
  placeholder?: string
}

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
