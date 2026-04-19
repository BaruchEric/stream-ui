# stream-ui

Flexible UI framework that streams UI to the user, guided by an AI agent.

Part of a planned **agent-tools** framework family.

## Install

```bash
bun add @baruch-eric/stream-ui
```

Import the default styles once at the top of your app (or skip them and style `.sui-*` classes yourself):

```ts
import '@baruch-eric/stream-ui/styles.css'
```

## Usage

```ts
import {
  render,
  append,
  clear,
  type ComponentSpec,
  type ActionEvent,
} from '@baruch-eric/stream-ui'

const stage = document.getElementById('app')!

const spec: ComponentSpec = {
  kind: 'card',
  title: 'Hello',
  body: 'Rendered by the agent.',
}

render(spec, stage, (event: ActionEvent) => {
  console.log('UI action:', event.action, event.payload)
})
```

### Component kinds

**Display** — `text` · `heading` · `paragraph` · `code` · `divider` · `image`

**Container & layout** — `card` (now accepts `children`) · `stack` · `row` · `grid`

**Feedback** — `alert` (info / success / warning / error) · `badge` · `spinner` · `progress`

**Data** — `list` (ordered or unordered) · `table`

**Input** — `input` · `textarea` · `select` · `checkbox` · `form`

**Action** — `button` (default / primary / danger) · `link`

Inputs and actions fire `ActionEvent { action, payload? }` through the optional handler — feed those back into your agent loop to close the human ↔ AI ↔ UI loop.

### Composition

`card`, `stack`, `row`, and `grid` recursively render `children: ComponentSpec[]`, so the agent can compose primitives into arbitrary trees:

```ts
render({
  kind: 'card',
  title: 'Confirm',
  children: [
    { kind: 'paragraph', content: 'Are you sure?' },
    {
      kind: 'row', gap: 'sm',
      children: [
        { kind: 'button', label: 'Cancel', action: 'cancel' },
        { kind: 'button', label: 'OK', action: 'ok', variant: 'primary' },
      ],
    },
  ],
}, stage, onAction)
```

Layout primitives accept `gap: 'sm' | 'md' | 'lg'`. `row` also accepts `align: 'start' | 'center' | 'end'`. `grid` accepts `columns: number`.

### API

**Dispatch (uses the registry):**

- `render(spec, container, onAction?)` — replace container content with a single component
- `append(spec, container, onAction?)` — append a component to existing content
- `createElement(spec, onAction?)` — low-level: spec → DOM element
- `clear(container)` — empty the container

**Registry — extend with your own kinds:**

```ts
import { register, listKinds } from '@baruch-eric/stream-ui'

type KanbanCardSpec = {
  kind: 'kanban-card'
  title: string
  status: 'todo' | 'doing' | 'done'
}

register<KanbanCardSpec>('kanban-card', (spec, onAction) => {
  const el = document.createElement('article')
  el.className = `kanban-card kanban-${spec.status}`
  el.textContent = spec.title
  return el
})

// Now any consumer (the agent, your code, anywhere) can render this:
render({ kind: 'kanban-card', title: 'Ship it', status: 'doing' }, stage)

// listKinds() is useful for generating an agent's tool schema:
console.log(listKinds())  // ['alert', 'badge', 'button', ..., 'kanban-card']
```

- `register(kind, renderer)` — add a renderer for a custom kind (or override a built-in)
- `unregister(kind)` — remove a kind
- `getRenderer(kind)` — look up a renderer
- `hasKind(kind)` — check if registered
- `listKinds()` — array of all registered kinds (sorted)

**Use built-ins directly without the registry:**

Every built-in is a pure function exposed via `builtins.<kind>`. Call them with no framework state if you want:

```ts
import { builtins } from '@baruch-eric/stream-ui'

const buttonEl = builtins.button({ kind: 'button', label: 'Hi', action: 'x' })
container.appendChild(buttonEl)
```

### Architecture

The framework is intentionally **agent-agnostic**:

- The agent (or your code) generates `ComponentSpec` JSON.
- The framework dispatches each spec through the registry → DOM.
- Built-ins, registry, and dispatch are three separable concerns. Each renderer is a pure `(spec, onAction?) => HTMLElement` and can be called independently of the rest of the framework.

The agent is the *primary* consumer, but never the *only* one.

## Playground

```bash
bun run playground         # mock keyword-routed agent, no API key required
# or
bun run playground:full    # real LLM + mock fallback (needs AI_GATEWAY_API_KEY)
```

Opens a 3-pane demo at http://localhost:5173:

- **CHAT** — type a prompt
- **AI** — the agent's reasoning stream
- **UI** — the components the agent renders

Try: `palette` (renders one of every kind), `make a button`, `alert error`, `show a table`, `add a checkbox`.

### Real LLM mode

`bun run playground:full` runs the Vite dev server plus a small bun HTTP server at `:3030` that proxies `POST /api/agent` through the Vercel AI Gateway. The model calls two tools — `render_ui(spec)` and `append_ui(spec)` — and the server streams each tool call back to the browser as SSE, feeding the same render/append loop the mock uses.

Copy `.env.example` → `.env.local` and set:

```bash
AI_GATEWAY_API_KEY=...                     # from https://vercel.com/ai-gateway
# AI_MODEL=anthropic/claude-sonnet-4-6     # override the default model
```

If the server isn't running or the key isn't set, the playground automatically falls back to the mock keyword-routed agent.

## Develop

```bash
bun install
bun run dev          # tsup watch (rebuild dist/)
bun run playground   # vite playground at :5173
bun test
bun run lint
bun run typecheck
bun run build
```

## License

[MIT](./LICENSE) © Eric Baruch
