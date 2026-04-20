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

export const VERSION = '0.6.1'

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
export { safeHref, safeImageSrc } from './safe-url'
export { applyMask, validate } from './validation'
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
  InputFormat,
  InputType,
  Renderer,
  SelectOption,
  SpecOf,
  ValidationRules,
} from './types'

// ─── high-level convenience wrappers ────────────────────────────────────

// Focus preservation: `render()` replaces the entire subtree, which destroys
// focus, selection, and IME state. Before the replace we snapshot the active
// form control (by id or name); after the replace we find the matching node
// in the new tree and restore focus + selection range. This makes the
// framework usable for real input flows — without it, any re-render during
// typing blows away the user's cursor position.
type PreservedFocus = {
  id: string | null
  name: string | null
  selectionStart: number | null
  selectionEnd: number | null
}

function capturePreservable(container: HTMLElement): PreservedFocus | null {
  if (typeof document === 'undefined') return null
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return null
  if (!container.contains(active)) return null
  const id = active.id || null
  const name =
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement
      ? active.name || null
      : null
  if (!id && !name) return null
  let selectionStart: number | null = null
  let selectionEnd: number | null = null
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    try {
      selectionStart = active.selectionStart
      selectionEnd = active.selectionEnd
    } catch {
      // some input types (e.g. number) don't support selection
    }
  }
  return { id, name, selectionStart, selectionEnd }
}

function restorePreserved(container: HTMLElement, preserved: PreservedFocus): void {
  let target: HTMLElement | null = null
  if (preserved.id && typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    const el = container.querySelector(`#${CSS.escape(preserved.id)}`)
    if (el instanceof HTMLElement) target = el
  }
  if (!target && preserved.name) {
    const el = container.querySelector(`[name="${preserved.name}"]`)
    if (el instanceof HTMLElement) target = el
  }
  if (!target) return
  target.focus()
  if (
    (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
    preserved.selectionStart !== null &&
    preserved.selectionEnd !== null
  ) {
    try {
      target.setSelectionRange(preserved.selectionStart, preserved.selectionEnd)
    } catch {
      // non-selectable input types — best effort
    }
  }
}

export function render(
  spec: ComponentSpec | AnySpec,
  container: HTMLElement,
  onAction?: ActionHandler,
): void {
  const preserved = capturePreservable(container)
  container.replaceChildren(createElement(spec, onAction))
  if (preserved) restorePreserved(container, preserved)
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
