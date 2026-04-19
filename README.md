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

### Component kinds

- `text` — `{ kind: 'text', content }`
- `card` — `{ kind: 'card', title, body }`
- `button` — `{ kind: 'button', label, action }`
- `list` — `{ kind: 'list', items }`
- `form` — `{ kind: 'form', submitLabel, fields: [{ name, label, type, placeholder? }] }`

Buttons and form submissions fire `ActionEvent { action, payload? }` through the optional handler — feed those back into your agent loop to close the human ↔ AI ↔ UI loop.

## Playground

```bash
bun run playground
```

Opens a 3-pane demo at http://localhost:5173:

- **CHAT** — type a prompt
- **AI** — the (mock) agent's reasoning stream
- **UI** — the components the agent renders

Try: `make a button`, `build a form`, `show a list`, `add a card`.

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
