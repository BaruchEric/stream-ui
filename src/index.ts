/**
 * stream-ui — Flexible UI framework that streams UI to the user, guided
 * by an AI agent.
 *
 * The framework is intentionally agent-agnostic. The agent (or any other
 * consumer) generates `ComponentSpec` JSON; the framework dispatches each
 * spec through a registry of renderers and produces DOM. Built-in
 * components are auto-registered on import, but every renderer is a pure
 * function exposed via `builtins.<kind>` and callable on its own — you can
 * use stream-ui without ever touching the registry if you want.
 *
 * To extend: `register('my-kind', myRenderer)`.
 * To dispatch: `render(spec, container, onAction?)`.
 * To list available kinds (e.g. for an agent's tool schema): `listKinds()`.
 */

import { builtins } from './components'
import { createElement, register } from './registry'
import type { ActionHandler, AnySpec, ComponentSpec, Renderer } from './types'

// Auto-register every built-in on module load. Consumers can call
// `unregister('button')` afterward if they want to disable a built-in.
// The cast widens each per-kind Renderer<SpecOf<K>> to the registry's
// permissive Renderer type — runtime dispatch only cares about `kind`.
for (const [kind, renderer] of Object.entries(builtins) as Array<[string, Renderer]>) {
  register(kind, renderer)
}

export const VERSION = '0.4.0'

// ─── re-exports ─────────────────────────────────────────────────────────
export { builtins } from './components'
export {
  createElement,
  getRenderer,
  hasKind,
  listKinds,
  register,
  unregister,
} from './registry'
export type {
  ActionEvent,
  ActionHandler,
  AgentEvent,
  AlertVariant,
  AnySpec,
  BadgeVariant,
  ButtonVariant,
  ComponentKind,
  ComponentSpec,
  FormField,
  Gap,
  HeadingLevel,
  InputType,
  Renderer,
  SelectOption,
  SpecOf,
} from './types'

// ─── high-level convenience wrappers ────────────────────────────────────
export function render(
  spec: ComponentSpec | AnySpec,
  container: HTMLElement,
  onAction?: ActionHandler,
): void {
  container.replaceChildren(createElement(spec, onAction))
}

export function append(
  spec: ComponentSpec | AnySpec,
  container: HTMLElement,
  onAction?: ActionHandler,
): void {
  container.appendChild(createElement(spec, onAction))
}

export function clear(container: HTMLElement): void {
  container.replaceChildren()
}
