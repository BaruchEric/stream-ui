# stream-ui

Flexible UI framework that streams UI to the user, guided by an AI agent.

Part of a planned **agent-tools** framework family.

## Install

```bash
bun add stream-ui
```

## Usage

```ts
import { render, append, clear, type ComponentSpec, type ActionEvent } from 'stream-ui'

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

### Component kinds (v0.2)

**Display** — `text` · `heading` · `paragraph` · `code` · `divider` · `image`

**Container** — `card`

**Feedback** — `alert` (info / success / warning / error) · `badge` · `spinner` · `progress`

**Data** — `list` (ordered or unordered) · `table`

**Input** — `input` · `textarea` · `select` · `checkbox` · `form`

**Action** — `button` (default / primary / danger) · `link`

Inputs and actions fire `ActionEvent { action, payload? }` through the optional handler — feed those back into your agent loop to close the human ↔ AI ↔ UI loop.

### API

- `render(spec, container, onAction?)` — replace container content with a single component
- `append(spec, container, onAction?)` — append a component to existing content
- `clear(container)` — empty the container

## Playground

```bash
bun run playground
```

Opens a 3-pane demo at http://localhost:5173:

- **CHAT** — type a prompt
- **AI** — the (mock) agent's reasoning stream
- **UI** — the components the agent renders

Try: `palette` (renders one of every kind), `make a button`, `alert error`, `show a table`, `add a checkbox`.

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

TBD
