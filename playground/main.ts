import '../src/styles.css'
import {
  type ActionEvent,
  type ActionHandler,
  type AnySpec,
  type ComponentSpec,
  VERSION,
  append,
  listKinds,
  register,
  render,
} from '../src/index'

// ─── Message state and localStorage ─────────────────────────────────────

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

// ─── DEMO: register a custom (consumer-defined) component kind ──────────
// This is what an app would do to add domain-specific UI to stream-ui:
// declare a spec shape, write a renderer, call register(). The agent (or
// any other consumer) can then emit `{ kind: 'kanban-card', ... }` and the
// framework will dispatch to this renderer just like any built-in.
type KanbanCardSpec = {
  kind: 'kanban-card'
  title: string
  status: 'todo' | 'doing' | 'done'
  assignee?: string
  action?: string
}

register<KanbanCardSpec>('kanban-card', (spec, onAction) => {
  const el = document.createElement('article')
  el.className = `kanban-card kanban-${spec.status}`
  const titleEl = document.createElement('strong')
  titleEl.className = 'kanban-title'
  titleEl.textContent = spec.title
  const statusEl = document.createElement('span')
  statusEl.className = 'kanban-status'
  statusEl.textContent = spec.status.toUpperCase()
  const headerRow = document.createElement('div')
  headerRow.className = 'kanban-header'
  headerRow.append(titleEl, statusEl)
  el.appendChild(headerRow)
  if (spec.assignee) {
    const assigneeEl = document.createElement('span')
    assigneeEl.className = 'kanban-assignee'
    assigneeEl.textContent = `@${spec.assignee}`
    el.appendChild(assigneeEl)
  }
  const action = spec.action
  if (action) {
    el.style.cursor = 'pointer'
    el.addEventListener('click', () => onAction?.({ action, payload: { title: spec.title } }))
  }
  return el
})

const chatLog = document.getElementById('chat-log') as HTMLElement
const chatInput = document.getElementById('chat-input') as HTMLInputElement
const chatForm = document.getElementById('chat-form') as HTMLFormElement
const aiStream = document.getElementById('ai-stream') as HTMLElement
const uiStage = document.getElementById('ui-stage') as HTMLElement
const sendBtn = chatForm.querySelector('button[type="submit"]') as HTMLButtonElement

console.log(`[stream-ui] playground v${VERSION} ready`)

// ─── panel resizing ─────────────────────────────────────────────────────
// Layout: CHAT and AI sit side-by-side on top; UI spans the full width
// below. The vertical handle between CHAT and AI tunes the top row's
// column split; the horizontal handle between the top row and UI tunes
// the overall row split. Both sizes persist in localStorage.
const grid = document.getElementById('grid') as HTMLDivElement | null
const PANEL_SIZES_KEY = 'sui:playground:panel-sizes-v2'
const MIN_PANEL_PX = 80

type PanelSizes = {
  colChat: number
  colAi: number
  rowTop: number
  rowUi: number
}

function loadPanelSizes(): PanelSizes | null {
  try {
    const raw = localStorage.getItem(PANEL_SIZES_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PanelSizes>
    if (
      typeof parsed.colChat === 'number' &&
      typeof parsed.colAi === 'number' &&
      typeof parsed.rowTop === 'number' &&
      typeof parsed.rowUi === 'number' &&
      parsed.colChat >= MIN_PANEL_PX &&
      parsed.colAi >= MIN_PANEL_PX &&
      parsed.rowTop >= MIN_PANEL_PX &&
      parsed.rowUi >= MIN_PANEL_PX
    ) {
      return parsed as PanelSizes
    }
    return null
  } catch {
    return null
  }
}

function applyPanelSizes(sizes: PanelSizes): void {
  if (!grid) return
  grid.style.gridTemplateColumns = `${sizes.colChat}px 6px ${sizes.colAi}px`
  grid.style.gridTemplateRows = `${sizes.rowTop}px 6px ${sizes.rowUi}px`
}

function savePanelSizes(sizes: PanelSizes): void {
  try {
    localStorage.setItem(PANEL_SIZES_KEY, JSON.stringify(sizes))
  } catch {
    // ignore quota errors
  }
}

function measurePanelSizes(): PanelSizes | null {
  if (!grid) return null
  const chat = grid.querySelector<HTMLElement>('.region-chat')
  const ai = grid.querySelector<HTMLElement>('.region-ai')
  const ui = grid.querySelector<HTMLElement>('.region-ui')
  if (!chat || !ai || !ui) return null
  return {
    colChat: chat.getBoundingClientRect().width,
    colAi: ai.getBoundingClientRect().width,
    rowTop: chat.getBoundingClientRect().height,
    rowUi: ui.getBoundingClientRect().height,
  }
}

if (grid) {
  const saved = loadPanelSizes()
  if (saved) applyPanelSizes(saved)

  const resizers = grid.querySelectorAll<HTMLDivElement>('.resizer')
  for (const resizer of resizers) {
    const axis = resizer.dataset.resizeAxis as 'col' | 'row'
    resizer.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      resizer.setPointerCapture(e.pointerId)
      const start = measurePanelSizes()
      if (!start) return
      const startCoord = axis === 'col' ? e.clientX : e.clientY
      resizer.classList.add('dragging')
      document.body.classList.add(axis === 'col' ? 'resizing-col' : 'resizing-row')

      const onMove = (ev: PointerEvent) => {
        const coord = axis === 'col' ? ev.clientX : ev.clientY
        const delta = coord - startCoord
        const next: PanelSizes = { ...start }
        if (axis === 'col') {
          let a = start.colChat + delta
          let b = start.colAi - delta
          if (a < MIN_PANEL_PX) {
            b -= MIN_PANEL_PX - a
            a = MIN_PANEL_PX
          }
          if (b < MIN_PANEL_PX) {
            a -= MIN_PANEL_PX - b
            b = MIN_PANEL_PX
          }
          next.colChat = Math.max(MIN_PANEL_PX, a)
          next.colAi = Math.max(MIN_PANEL_PX, b)
        } else {
          let a = start.rowTop + delta
          let b = start.rowUi - delta
          if (a < MIN_PANEL_PX) {
            b -= MIN_PANEL_PX - a
            a = MIN_PANEL_PX
          }
          if (b < MIN_PANEL_PX) {
            a -= MIN_PANEL_PX - b
            b = MIN_PANEL_PX
          }
          next.rowTop = Math.max(MIN_PANEL_PX, a)
          next.rowUi = Math.max(MIN_PANEL_PX, b)
        }
        applyPanelSizes(next)
      }

      const onEnd = (ev: PointerEvent) => {
        resizer.releasePointerCapture(ev.pointerId)
        resizer.classList.remove('dragging')
        document.body.classList.remove('resizing-col', 'resizing-row')
        resizer.removeEventListener('pointermove', onMove)
        resizer.removeEventListener('pointerup', onEnd)
        resizer.removeEventListener('pointercancel', onEnd)
        const final = measurePanelSizes()
        if (final) savePanelSizes(final)
      }

      resizer.addEventListener('pointermove', onMove)
      resizer.addEventListener('pointerup', onEnd)
      resizer.addEventListener('pointercancel', onEnd)
    })
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function pushChat(who: 'human' | 'agent' | 'system', text: string): void {
  const el = document.createElement('div')
  el.className = `chat-msg chat-${who}`
  el.textContent = text
  chatLog.appendChild(el)
  chatLog.scrollTop = chatLog.scrollHeight
}

function pushAI(text: string, variant: 'thinking' | 'normal' | 'action' = 'normal'): void {
  const el = document.createElement('div')
  el.className = `ai-line ${variant === 'normal' ? '' : variant}`.trim()
  el.textContent = text
  aiStream.appendChild(el)
  aiStream.scrollTop = aiStream.scrollHeight
}

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

type AgentEvent =
  | { type: 'thinking'; text: string }
  | { type: 'render'; spec: ComponentSpec | AnySpec }
  | { type: 'append'; spec: ComponentSpec | AnySpec }

function paletteSpecs(): ComponentSpec[] {
  return [
    { kind: 'heading', level: 2, content: 'Component palette' },
    { kind: 'paragraph', content: 'Every kind in stream-ui v0.2, rendered in sequence.' },
    { kind: 'divider' },
    { kind: 'heading', level: 4, content: 'Feedback' },
    { kind: 'alert', variant: 'info', content: 'Info: this is an info alert.' },
    { kind: 'alert', variant: 'success', content: 'Success: operation complete.' },
    { kind: 'alert', variant: 'warning', content: 'Warning: heads up.' },
    { kind: 'alert', variant: 'error', content: 'Error: something failed.' },
    { kind: 'badge', content: 'New', variant: 'success' },
    { kind: 'spinner', label: 'Loading…' },
    { kind: 'progress', value: 65, label: 'Indexing' },
    { kind: 'divider' },
    { kind: 'heading', level: 4, content: 'Container & data' },
    { kind: 'card', title: 'Card title', body: 'A card groups related content.' },
    { kind: 'list', items: ['First', 'Second', 'Third'] },
    { kind: 'list', items: ['Step one', 'Step two', 'Step three'], ordered: true },
    {
      kind: 'table',
      headers: ['Name', 'Role', 'City'],
      rows: [
        ['Alice', 'Engineer', 'NYC'],
        ['Bob', 'Designer', 'LA'],
        ['Carol', 'PM', 'SF'],
      ],
    },
    { kind: 'divider' },
    { kind: 'heading', level: 4, content: 'Inputs' },
    {
      kind: 'input',
      name: 'search',
      label: 'Search',
      placeholder: 'Type to search…',
      action: 'search',
    },
    {
      kind: 'textarea',
      name: 'notes',
      label: 'Notes',
      placeholder: 'Write something',
      rows: 3,
      action: 'note',
    },
    {
      kind: 'select',
      name: 'city',
      label: 'City',
      options: [
        { value: 'nyc', label: 'New York' },
        { value: 'la', label: 'Los Angeles' },
        { value: 'sf', label: 'San Francisco' },
      ],
      action: 'pick-city',
    },
    { kind: 'checkbox', name: 'agree', label: 'I agree to the terms', action: 'toggle-agree' },
    {
      kind: 'form',
      submitLabel: 'Save',
      fields: [
        { name: 'name', label: 'Name', type: 'text', placeholder: 'Your name' },
        { name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
      ],
    },
    { kind: 'divider' },
    { kind: 'heading', level: 4, content: 'Actions' },
    { kind: 'button', label: 'Default', action: 'demo-default' },
    { kind: 'button', label: 'Primary', action: 'demo-primary', variant: 'primary' },
    { kind: 'button', label: 'Danger', action: 'demo-danger', variant: 'danger' },
    { kind: 'link', label: 'Open repo on GitHub', href: 'https://github.com/BaruchEric/stream-ui' },
    { kind: 'divider' },
    { kind: 'heading', level: 4, content: 'Composition (nested)' },
    {
      kind: 'card',
      title: 'Card with children',
      children: [
        { kind: 'paragraph', content: 'Cards can hold any components, not just text.' },
        {
          kind: 'row',
          gap: 'sm',
          children: [
            { kind: 'badge', content: 'NEW', variant: 'success' },
            { kind: 'badge', content: 'beta', variant: 'warning' },
            { kind: 'badge', content: 'v0.3', variant: 'default' },
          ],
        },
        {
          kind: 'row',
          gap: 'sm',
          children: [
            { kind: 'button', label: 'Cancel', action: 'composite-cancel' },
            { kind: 'button', label: 'Save', action: 'composite-save', variant: 'primary' },
          ],
        },
      ],
    },
    {
      kind: 'stack',
      gap: 'sm',
      children: [
        { kind: 'heading', level: 5, content: 'Vertical stack' },
        { kind: 'alert', variant: 'info', content: 'Children stacked vertically with sm gap.' },
        { kind: 'progress', value: 80, label: 'Stack demo' },
      ],
    },
    {
      kind: 'grid',
      columns: 2,
      gap: 'sm',
      children: [
        { kind: 'card', title: 'Tile A', body: '2-col grid cell.' },
        { kind: 'card', title: 'Tile B', body: '2-col grid cell.' },
        { kind: 'card', title: 'Tile C', body: '2-col grid cell.' },
        { kind: 'card', title: 'Tile D', body: '2-col grid cell.' },
      ],
    },
    { kind: 'divider' },
    { kind: 'heading', level: 4, content: 'Misc' },
    {
      kind: 'image',
      src: 'https://placehold.co/400x100/333/fff?text=stream-ui',
      alt: 'Placeholder',
    },
    { kind: 'code', content: "import { render } from 'stream-ui'", language: 'typescript' },
    { kind: 'text', content: 'Plain text content (no semantic wrapper).' },
  ]
}

function detectAlertVariant(prompt: string): 'info' | 'success' | 'warning' | 'error' {
  const l = prompt.toLowerCase()
  if (l.includes('error') || l.includes('fail')) return 'error'
  if (l.includes('success') || l.includes('done')) return 'success'
  if (l.includes('warning') || l.includes('warn')) return 'warning'
  return 'info'
}

function extractAfter(prompt: string, keywords: string[]): string | null {
  for (const kw of keywords) {
    const idx = prompt.toLowerCase().indexOf(kw)
    if (idx >= 0) {
      const tail = prompt.slice(idx + kw.length).trim()
      const cleaned = tail.replace(/^(labeled|saying|titled|with|to|about|:)\s+/i, '')
      if (cleaned.length > 0 && cleaned.length < 80)
        return cleaned.replace(/^[:\-—\s"']+|["'\s]+$/g, '')
    }
  }
  return null
}

// Table of keyword-triggered component demos. The mock agent scans the
// prompt in order and yields the first matching route's spec. Order
// matters: more-specific keywords must appear before broader ones (e.g.
// `textarea` before `input`). Each route's `thinking` is the AI-stream
// line; `spec` builds the ComponentSpec (or AnySpec for custom kinds).
type Route = {
  keywords: string[]
  thinking: string | ((prompt: string, lower: string) => string)
  spec: (prompt: string, lower: string) => ComponentSpec | AnySpec
}

const keywordRoutes: Route[] = [
  {
    keywords: ['textarea'],
    thinking: 'Component → textarea',
    spec: (p) => ({
      kind: 'textarea',
      name: 'demo',
      label: extractAfter(p, ['textarea']) || 'Notes',
      placeholder: 'Write something',
      rows: 4,
      action: 'demo-textarea',
    }),
  },
  {
    keywords: ['checkbox', 'toggle'],
    thinking: 'Component → checkbox',
    spec: (p) => ({
      kind: 'checkbox',
      name: 'demo',
      label: extractAfter(p, ['checkbox', 'toggle']) || 'Enable demo',
      action: 'demo-checkbox',
    }),
  },
  {
    keywords: ['select', 'dropdown'],
    thinking: 'Component → select',
    spec: (p) => ({
      kind: 'select',
      name: 'demo',
      label: extractAfter(p, ['select', 'dropdown']) || 'Pick one',
      options: [
        { value: 'a', label: 'Option A' },
        { value: 'b', label: 'Option B' },
        { value: 'c', label: 'Option C' },
      ],
      action: 'demo-select',
    }),
  },
  {
    keywords: ['text field', 'textbox', 'input'],
    thinking: 'Component → input',
    spec: (p) => ({
      kind: 'input',
      name: 'demo',
      label: extractAfter(p, ['input', 'textbox', 'text field']) || 'Demo input',
      placeholder: 'Type something',
      action: 'demo-input',
    }),
  },
  {
    keywords: ['form'],
    thinking: 'Component → form (name + email)',
    spec: () => ({
      kind: 'form',
      submitLabel: 'Submit',
      fields: [
        { name: 'name', label: 'Name', type: 'text', placeholder: 'Your name' },
        { name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
      ],
    }),
  },
  {
    keywords: ['button'],
    thinking: 'Component → button',
    spec: (p, lower) => {
      const variant = lower.includes('danger')
        ? 'danger'
        : lower.includes('primary')
          ? 'primary'
          : 'default'
      return {
        kind: 'button',
        label: extractAfter(p, ['button']) || 'Click me',
        action: 'demo-click',
        variant,
      }
    },
  },
  {
    keywords: ['link'],
    thinking: 'Component → link',
    spec: (p) => ({
      kind: 'link',
      label: extractAfter(p, ['link']) || 'Open GitHub',
      href: 'https://github.com/BaruchEric/stream-ui',
    }),
  },
  {
    keywords: ['table'],
    thinking: 'Component → table',
    spec: () => ({
      kind: 'table',
      headers: ['Name', 'Value'],
      rows: [
        ['Alpha', '1'],
        ['Beta', '2'],
        ['Gamma', '3'],
      ],
    }),
  },
  {
    keywords: ['list'],
    thinking: 'Component → list',
    spec: (_p, lower) => ({
      kind: 'list',
      items: ['First item', 'Second item', 'Third item'],
      ordered: lower.includes('numbered') || lower.includes('ordered') || lower.includes('1.'),
    }),
  },
  {
    keywords: ['card'],
    thinking: 'Component → card',
    spec: (p) => ({
      kind: 'card',
      title: extractAfter(p, ['card']) || 'Generated card',
      body: 'This card was rendered by the agent.',
    }),
  },
  {
    keywords: ['alert', 'warning', 'error'],
    thinking: (p) => `Component → alert (${detectAlertVariant(p)})`,
    spec: (p) => {
      const variant = detectAlertVariant(p)
      return {
        kind: 'alert',
        variant,
        content: extractAfter(p, ['alert', 'warning', 'error', 'message']) || `${variant} alert`,
      }
    },
  },
  {
    keywords: ['badge', 'tag'],
    thinking: 'Component → badge',
    spec: (p) => ({
      kind: 'badge',
      content: extractAfter(p, ['badge', 'tag']) || 'New',
    }),
  },
  {
    keywords: ['spinner', 'loading'],
    thinking: 'Component → spinner',
    spec: () => ({ kind: 'spinner', label: 'Loading…' }),
  },
  {
    keywords: ['progress'],
    thinking: 'Component → progress (50%)',
    spec: () => ({ kind: 'progress', value: 50, label: 'Working' }),
  },
  {
    keywords: ['image', 'picture'],
    thinking: 'Component → image',
    spec: () => ({
      kind: 'image',
      src: 'https://placehold.co/400x200/444/fff?text=stream-ui',
      alt: 'Placeholder image',
    }),
  },
  {
    keywords: ['divider', 'separator'],
    thinking: 'Component → divider',
    spec: () => ({ kind: 'divider' }),
  },
  {
    keywords: ['code'],
    thinking: 'Component → code',
    spec: (p) => ({
      kind: 'code',
      content: extractAfter(p, ['code']) || "console.log('hi')",
      language: 'typescript',
    }),
  },
  {
    keywords: ['heading', 'title'],
    thinking: 'Component → heading',
    spec: (p) => ({
      kind: 'heading',
      level: 2,
      content: extractAfter(p, ['heading', 'title']) || 'Heading',
    }),
  },
  {
    keywords: ['stack', 'vertical'],
    thinking: 'Component → stack',
    spec: () => ({
      kind: 'stack',
      gap: 'sm',
      children: [
        { kind: 'heading', level: 4, content: 'Stacked' },
        { kind: 'paragraph', content: 'Vertical layout primitive.' },
        { kind: 'button', label: 'Action', action: 'stack-demo' },
      ],
    }),
  },
  {
    keywords: ['row', 'horizontal', 'side by side'],
    thinking: 'Component → row',
    spec: () => ({
      kind: 'row',
      gap: 'sm',
      align: 'center',
      children: [
        { kind: 'badge', content: 'one' },
        { kind: 'badge', content: 'two', variant: 'success' },
        { kind: 'badge', content: 'three', variant: 'warning' },
      ],
    }),
  },
  {
    keywords: ['kanban'],
    thinking: () =>
      `Component → kanban-card (custom-registered, ${listKinds().length} kinds total)`,
    spec: (p, lower) => {
      const status: 'todo' | 'doing' | 'done' = lower.includes('done')
        ? 'done'
        : lower.includes('doing') || lower.includes('progress')
          ? 'doing'
          : 'todo'
      return {
        kind: 'kanban-card',
        title: extractAfter(p, ['kanban']) || 'Implement feature X',
        status,
        assignee: 'eric',
        action: 'kanban-click',
      } as AnySpec
    },
  },
  {
    keywords: ['grid'],
    thinking: 'Component → grid (2-col)',
    spec: () => ({
      kind: 'grid',
      columns: 2,
      gap: 'sm',
      children: [
        { kind: 'card', title: 'A', body: 'Cell' },
        { kind: 'card', title: 'B', body: 'Cell' },
        { kind: 'card', title: 'C', body: 'Cell' },
        { kind: 'card', title: 'D', body: 'Cell' },
      ],
    }),
  },
  {
    keywords: ['paragraph'],
    thinking: 'Component → paragraph',
    spec: (p) => ({
      kind: 'paragraph',
      content: extractAfter(p, ['paragraph']) || 'A paragraph of text.',
    }),
  },
]

// ─── real LLM client (talks to playground/server.ts via SSE) ────────────
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
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let split = buffer.indexOf('\n\n')
    while (split !== -1) {
      const chunk = buffer.slice(0, split)
      buffer = buffer.slice(split + 2)
      split = buffer.indexOf('\n\n')
      if (!chunk.startsWith('data:')) continue
      const payload = chunk.slice(chunk.indexOf(':') + 1).trim()
      try {
        const event = JSON.parse(payload) as {
          type: string
          text?: string
          spec?: ComponentSpec | AnySpec
          error?: string
        }
        if (event.type === 'thinking' && event.text) {
          yield { type: 'thinking', text: event.text }
        } else if (event.type === 'render' && event.spec) {
          yield { type: 'render', spec: event.spec }
        } else if (event.type === 'append' && event.spec) {
          yield { type: 'append', spec: event.spec }
        } else if (event.type === 'error') {
          throw new Error(event.error ?? 'agent error')
        } else if (event.type === 'done') {
          return
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('agent error')) throw err
        console.warn('[playground] bad SSE payload:', payload, err)
      }
    }
  }
}

async function* mockAgent(prompt: string): AsyncGenerator<AgentEvent> {
  yield { type: 'thinking', text: 'Parsing prompt…' }
  await sleep(200)
  yield { type: 'thinking', text: `Heard: "${prompt}"` }
  await sleep(250)

  const lower = prompt.toLowerCase()
  const shouldAppend = lower.includes('add') || lower.includes('append') || lower.includes('also')
  const op = (shouldAppend ? 'append' : 'render') as 'append' | 'render'

  // Palette / show all
  if (
    lower.includes('palette') ||
    lower.includes('all components') ||
    lower.includes('show all') ||
    lower.includes('show everything') ||
    lower === 'demo' ||
    lower === 'everything'
  ) {
    const specs = paletteSpecs()
    yield { type: 'thinking', text: `Rendering palette: ${specs.length} components` }
    await sleep(200)
    yield { type: 'render', spec: specs[0] }
    for (let i = 1; i < specs.length; i++) {
      await sleep(60)
      yield { type: 'append', spec: specs[i] }
    }
    return
  }

  // Clear / reset
  if (lower.includes('clear') || lower.includes('reset')) {
    yield { type: 'thinking', text: 'Clearing UI region' }
    await sleep(120)
    yield { type: 'render', spec: { kind: 'text', content: '(cleared)' } }
    return
  }

  // Scan routes in order; first keyword hit wins.
  for (const route of keywordRoutes) {
    if (!route.keywords.some((k) => lower.includes(k))) continue
    const text =
      typeof route.thinking === 'function' ? route.thinking(prompt, lower) : route.thinking
    yield { type: 'thinking', text }
    await sleep(200)
    yield { type: op, spec: route.spec(prompt, lower) }
    return
  }

  // Fallback — no keyword matched.
  yield { type: 'thinking', text: 'No component match — echoing as text' }
  await sleep(150)
  yield { type: op, spec: { kind: 'text', content: prompt } }
}

// Try the real LLM first; if the server isn't running or the key isn't
// configured, fall back to the keyword-routed mock so the playground
// still works offline. The AGENT env flag lets you pin one or the other.
type AgentMode = 'auto' | 'llm' | 'mock'
const agentMode: AgentMode = (import.meta.env.VITE_AGENT_MODE as AgentMode) ?? 'auto'
let realAvailable = agentMode !== 'mock'

async function pingServer(): Promise<boolean> {
  try {
    const res = await fetch('/api/health')
    if (!res.ok) return false
    const info = (await res.json()) as { hasApiKey?: boolean }
    return Boolean(info.hasApiKey)
  } catch {
    return false
  }
}

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

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const prompt = chatInput.value.trim()
  if (!prompt) return
  pushChat('human', prompt)
  chatInput.value = ''
  addMessage({ role: 'user', kind: 'prompt', text: prompt })
  await runAgent()
})

if (agentMode === 'auto') {
  pingServer().then((ok) => {
    realAvailable = ok
    pushAI(
      ok
        ? 'LLM server detected — real agent active.'
        : 'No LLM server — using mock keyword agent. Start `bun run playground:full` with AI_GATEWAY_API_KEY to use a real model.',
      ok ? 'normal' : 'thinking',
    )
  })
} else {
  pushAI(agentMode === 'llm' ? 'Forced LLM mode.' : 'Forced mock mode.', 'thinking')
}

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

// Initial state
render(
  {
    kind: 'card',
    title: 'Welcome to stream-ui',
    body: 'Type a prompt in CHAT. Type "palette" to see every component at once. Try: "make a button", "alert error", "show a table", "add a checkbox".',
  },
  uiStage,
  onAction,
)
pushAI('Agent ready. Type "palette" to see all components.')
pushChat('system', 'session started')
