/**
 * stream-ui — Flexible UI framework that streams UI to the user, guided by an AI agent
 */

import { createElement } from './components'
import type { ActionHandler, ComponentSpec } from './types'

export type { ActionEvent, ActionHandler, AgentEvent, ComponentSpec, FormField } from './types'

export const VERSION = '0.3.0'

export function render(
  spec: ComponentSpec,
  container: HTMLElement,
  onAction?: ActionHandler,
): void {
  container.replaceChildren(createElement(spec, onAction))
}

export function append(
  spec: ComponentSpec,
  container: HTMLElement,
  onAction?: ActionHandler,
): void {
  container.appendChild(createElement(spec, onAction))
}

export function clear(container: HTMLElement): void {
  container.replaceChildren()
}
