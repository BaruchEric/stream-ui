import type { ActionHandler, AnySpec, Renderer } from './types'

// ─── kind → renderer registry ───────────────────────────────────────────
// Built-in renderers are auto-registered when `stream-ui` is imported
// (see `index.ts`). Consumers add their own kinds via `register(kind, fn)`.
// The registry is the only piece of global state in the framework — every
// individual renderer in `components.ts` is a pure function and can be
// called directly without going through the registry at all.
const registry = new Map<string, Renderer>()

export function register<T extends AnySpec>(kind: string, renderer: Renderer<T>): void {
  registry.set(kind, renderer as Renderer)
}

export function unregister(kind: string): boolean {
  return registry.delete(kind)
}

export function getRenderer(kind: string): Renderer | undefined {
  return registry.get(kind)
}

export function listKinds(): string[] {
  return [...registry.keys()].sort()
}

export function hasKind(kind: string): boolean {
  return registry.has(kind)
}

// ─── dispatch ───────────────────────────────────────────────────────────
// The low-level primitive: look up the kind in the registry, run its
// renderer. Returns a fallback DOM node if the kind is unknown — never
// throws (an agent generating unknown specs shouldn't crash the page).
export function createElement(spec: AnySpec, onAction?: ActionHandler): HTMLElement {
  const renderer = registry.get(spec.kind)
  if (!renderer) {
    const el = document.createElement('div')
    el.className = 'sui-unknown'
    el.textContent = `[unknown component kind: ${spec.kind}]`
    el.setAttribute('role', 'status')
    return el
  }
  return renderer(spec, onAction)
}
