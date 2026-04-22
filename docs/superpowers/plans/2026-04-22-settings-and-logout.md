# Settings Gear and Logout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings popover (model picker, layout presets, logout) to the playground header, plus a server model override and a Basic Auth logout endpoint.

**Architecture:** Client reads/writes a typed `SuiSettings` shape to `localStorage` (under `sui.*` keys). The playground grid gets three CSS-driven layout presets controlled by `data-*` attributes. The server's `/api/agent` accepts an optional validated `model` from the request body. A new `/api/logout` endpoint returns 401; the client also poisons the Basic Auth cache before reload to force a re-prompt in Chrome.

**Tech Stack:** TypeScript (vite for the playground, tsup for the library), vitest + happy-dom for tests, biome for lint, `ai` SDK with Vercel AI Gateway, Vercel Functions for the server endpoints.

**Spec:** [docs/superpowers/specs/2026-04-22-settings-and-logout-design.md](../specs/2026-04-22-settings-and-logout-design.md)

---

## File map

**Create**
- `playground/settings.ts` — typed `localStorage` wrapper + pure `applyLayout(grid, settings)`.
- `playground/settings.test.ts` — unit tests for the wrapper.
- `playground/settings-ui.ts` — `mountSettingsPopover(host, grid, onLogout)`.
- `api/model.ts` — pure `resolveModel(body, env)` helper.
- `api/model.test.ts` — unit tests for the helper.
- `api/logout.ts` — logout endpoint.

**Modify**
- `vitest.config.ts` — extend `include` to cover new test locations.
- `playground/index.html` — add gear button, popover root, uniform grid + resizers.
- `playground/style.css` — gear/popover styles, preset grid rules, hide-AI overrides.
- `playground/main.ts` — wire settings module, refactor resize to per-preset, include `model` in `/api/agent` POST, mount popover, handle logout.
- `api/agent.ts` — use `resolveModel(body, env)`.

---

## Task 1: Expand vitest coverage to playground + api

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: Update vitest include globs**

Replace the contents of `vitest.config.ts` with:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: '.',
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'playground/**/*.test.ts', 'api/**/*.test.ts'],
  },
})
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `bun run test`
Expected: all existing `src/*.test.ts` suites pass; no new suites collected yet.

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "test(config): include playground and api test files"
```

---

## Task 2: Settings data layer

**Files:**
- Create: `playground/settings.ts`
- Test: `playground/settings.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `playground/settings.test.ts`:

```ts
import { beforeEach, describe, expect, test } from 'vitest'
import {
  DEFAULT_MODEL,
  type LayoutPreset,
  readSettings,
  writeSettings,
} from './settings'

beforeEach(() => {
  localStorage.clear()
})

describe('readSettings', () => {
  test('returns defaults when localStorage is empty', () => {
    const s = readSettings()
    expect(s.model).toBe(DEFAULT_MODEL)
    expect(s.layout).toBe<LayoutPreset>('default')
    expect(s.hideAI).toBe(false)
    expect(s.sizes).toEqual({ default: {}, sideBySide: {}, stacked: {} })
  })

  test('round-trips written values', () => {
    writeSettings({ model: 'openai/gpt-5', layout: 'stacked', hideAI: true })
    const s = readSettings()
    expect(s.model).toBe('openai/gpt-5')
    expect(s.layout).toBe('stacked')
    expect(s.hideAI).toBe(true)
  })

  test('sizes are keyed per preset', () => {
    writeSettings({ sizes: { default: { 'chat-ai': 0.4 } } })
    writeSettings({ sizes: { sideBySide: { 'ai-ui': 0.5 } } })
    const s = readSettings()
    expect(s.sizes.default['chat-ai']).toBe(0.4)
    expect(s.sizes.sideBySide['ai-ui']).toBe(0.5)
    expect(s.sizes.stacked).toEqual({})
  })

  test('tolerates corrupt JSON in size keys', () => {
    localStorage.setItem('sui.layout.sizes.default', 'not-json{{{')
    const s = readSettings()
    expect(s.sizes.default).toEqual({})
  })

  test('unknown layout preset falls back to default', () => {
    localStorage.setItem('sui.layout.preset', 'wat')
    expect(readSettings().layout).toBe('default')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test playground/settings.test.ts`
Expected: FAIL — `Cannot find module './settings'`.

- [ ] **Step 3: Implement the module**

Create `playground/settings.ts`:

```ts
export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-6'

export const MODEL_PRESETS: ReadonlyArray<string> = [
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-opus-4-7',
  'anthropic/claude-haiku-4-5',
  'openai/gpt-5',
  'openai/gpt-4o',
  'google/gemini-2.5-pro',
]

export type LayoutPreset = 'default' | 'sideBySide' | 'stacked'
export const LAYOUT_PRESETS: ReadonlyArray<LayoutPreset> = ['default', 'sideBySide', 'stacked']

export type ResizerPair = 'chat-ai' | 'ai-ui' | 'top-bottom'
export type SizeMap = Partial<Record<ResizerPair, number>>

export type SuiSettings = {
  model: string
  layout: LayoutPreset
  hideAI: boolean
  sizes: Record<LayoutPreset, SizeMap>
}

const KEY_MODEL = 'sui.model'
const KEY_LAYOUT = 'sui.layout.preset'
const KEY_HIDE_AI = 'sui.layout.hideAI'
const sizesKey = (p: LayoutPreset) => `sui.layout.sizes.${p}`

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as unknown
    return (parsed ?? fallback) as T
  } catch {
    return fallback
  }
}

function readSizeMap(preset: LayoutPreset): SizeMap {
  const raw = readJSON<unknown>(sizesKey(preset), {})
  if (!raw || typeof raw !== 'object') return {}
  const out: SizeMap = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if ((k === 'chat-ai' || k === 'ai-ui' || k === 'top-bottom') && typeof v === 'number') {
      out[k] = v
    }
  }
  return out
}

export function readSettings(): SuiSettings {
  const rawLayout = localStorage.getItem(KEY_LAYOUT)
  const layout: LayoutPreset =
    rawLayout === 'default' || rawLayout === 'sideBySide' || rawLayout === 'stacked'
      ? rawLayout
      : 'default'
  return {
    model: localStorage.getItem(KEY_MODEL) ?? DEFAULT_MODEL,
    layout,
    hideAI: localStorage.getItem(KEY_HIDE_AI) === 'true',
    sizes: {
      default: readSizeMap('default'),
      sideBySide: readSizeMap('sideBySide'),
      stacked: readSizeMap('stacked'),
    },
  }
}

export type SettingsPatch = Partial<{
  model: string
  layout: LayoutPreset
  hideAI: boolean
  sizes: Partial<Record<LayoutPreset, SizeMap>>
}>

export function writeSettings(patch: SettingsPatch): void {
  try {
    if (patch.model !== undefined) localStorage.setItem(KEY_MODEL, patch.model)
    if (patch.layout !== undefined) localStorage.setItem(KEY_LAYOUT, patch.layout)
    if (patch.hideAI !== undefined) localStorage.setItem(KEY_HIDE_AI, String(patch.hideAI))
    if (patch.sizes !== undefined) {
      for (const [preset, map] of Object.entries(patch.sizes) as [LayoutPreset, SizeMap][]) {
        const existing = readSizeMap(preset)
        const merged = { ...existing, ...map }
        localStorage.setItem(sizesKey(preset), JSON.stringify(merged))
      }
    }
  } catch {
    // quota / disabled storage — best effort
  }
}

export function clearSizes(preset: LayoutPreset): void {
  try {
    localStorage.removeItem(sizesKey(preset))
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test playground/settings.test.ts`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add playground/settings.ts playground/settings.test.ts
git commit -m "feat(playground): settings data layer with per-preset size storage"
```

---

## Task 3: Server model resolution helper

**Files:**
- Create: `api/model.ts`
- Test: `api/model.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `api/model.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { DEFAULT_MODEL, resolveModel } from './model'

describe('resolveModel', () => {
  test('returns default when nothing supplied', () => {
    expect(resolveModel(undefined, {})).toBe(DEFAULT_MODEL)
  })

  test('uses AI_MODEL env when body model absent', () => {
    expect(resolveModel({}, { AI_MODEL: 'anthropic/claude-opus-4-7' })).toBe(
      'anthropic/claude-opus-4-7',
    )
  })

  test('accepts valid body.model over env', () => {
    expect(
      resolveModel({ model: 'openai/gpt-5' }, { AI_MODEL: 'anthropic/claude-sonnet-4-6' }),
    ).toBe('openai/gpt-5')
  })

  test('ignores empty string body.model', () => {
    expect(resolveModel({ model: '' }, { AI_MODEL: 'openai/gpt-4o' })).toBe('openai/gpt-4o')
  })

  test('rejects malformed slug (no slash)', () => {
    expect(resolveModel({ model: 'claude-sonnet-4-6' }, {})).toBe(DEFAULT_MODEL)
  })

  test('rejects slug with spaces or quotes', () => {
    expect(resolveModel({ model: 'anthropic/claude 4; drop table' }, {})).toBe(DEFAULT_MODEL)
  })

  test('accepts slug with dots, dashes, underscores', () => {
    expect(resolveModel({ model: 'vendor.x/my-model_v1.2' }, {})).toBe('vendor.x/my-model_v1.2')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test api/model.test.ts`
Expected: FAIL — `Cannot find module './model'`.

- [ ] **Step 3: Implement the helper**

Create `api/model.ts`:

```ts
export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-6'

const MODEL_SLUG = /^[\w.-]+\/[\w.-]+$/

export function resolveModel(
  body: { model?: unknown } | undefined,
  env: { AI_MODEL?: string },
): string {
  const candidate = body && typeof body.model === 'string' ? body.model : ''
  if (candidate && MODEL_SLUG.test(candidate)) return candidate
  const fromEnv = env.AI_MODEL
  if (fromEnv && MODEL_SLUG.test(fromEnv)) return fromEnv
  return DEFAULT_MODEL
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test api/model.test.ts`
Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add api/model.ts api/model.test.ts
git commit -m "feat(api): resolveModel helper validates client model override"
```

---

## Task 4: Use resolveModel in the agent route

**Files:**
- Modify: `api/agent.ts:10`, `api/agent.ts:150`

- [ ] **Step 1: Replace the module-level MODEL constant**

In `api/agent.ts`, remove the line:

```ts
const MODEL = process.env.AI_MODEL ?? 'anthropic/claude-sonnet-4-6'
```

Add an import at the top of the file (after the existing imports):

```ts
import { resolveModel } from './model.js'
```

- [ ] **Step 2: Resolve model per-request**

In `api/agent.ts`, inside `handler`, after the body is coerced to `messages` (just before `res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')`), add:

```ts
  const model = resolveModel(body as { model?: unknown } | undefined, process.env)
```

Then change:

```ts
    const result = streamText({
      model: MODEL,
```

to:

```ts
    const result = streamText({
      model,
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: passes.

- [ ] **Step 4: Run all tests**

Run: `bun run test`
Expected: all suites pass (no new failures).

- [ ] **Step 5: Commit**

```bash
git add api/agent.ts
git commit -m "feat(api/agent): honor client-supplied model with validation"
```

---

## Task 5: Logout endpoint

**Files:**
- Create: `api/logout.ts`

- [ ] **Step 1: Write the endpoint**

Create `api/logout.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('WWW-Authenticate', 'Basic realm="stream-ui playground"')
  res.status(401).send('Logged out')
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add api/logout.ts
git commit -m "feat(api/logout): 401 endpoint to trigger re-auth"
```

---

## Task 6: DOM + CSS refactor for layout presets

**Files:**
- Modify: `playground/index.html`
- Modify: `playground/style.css`

- [ ] **Step 1: Replace the grid markup in `playground/index.html`**

Replace the existing `<div class="grid" id="grid">…</div>` block with:

```html
    <div class="grid" id="grid" data-layout="default">
      <section class="region region-chat">
        <div class="panel-header">
          <h2>CHAT</h2>
          <button type="button" id="chat-clear" class="panel-header-btn">Clear</button>
        </div>
        <div id="chat-log" class="scroll" aria-live="polite"></div>
        <div id="chat-suggestions" class="chat-suggestions" aria-label="Prompt suggestions"></div>
        <form id="chat-form" class="chat-input">
          <input id="chat-input" type="text" placeholder="Ask the agent…" autocomplete="off" autofocus />
          <button type="submit">Send</button>
        </form>
      </section>

      <div class="resizer" data-pair="chat-ai" role="separator" aria-label="Resize chat and AI panels"></div>

      <section class="region region-ai">
        <h2>AI</h2>
        <div id="ai-stream" class="scroll" aria-live="polite"></div>
      </section>

      <div class="resizer" data-pair="ai-ui" role="separator" aria-label="Resize AI and UI panels"></div>

      <section class="region region-ui">
        <h2>UI</h2>
        <div id="ui-stage" class="scroll"></div>
      </section>

      <div class="resizer" data-pair="top-bottom" role="separator" aria-label="Resize top row and UI panel"></div>
    </div>
```

Also replace the existing `<header>…</header>` block with (adds the gear + popover root):

```html
    <header>
      <div class="header-main">
        <h1>stream-ui</h1>
        <p>Human → Agent → Streamed UI. Try: <code>make a button</code>, <code>build a form</code>, <code>show a list</code>, <code>card</code>.</p>
      </div>
      <div class="header-actions">
        <button type="button" id="settings-btn" class="settings-btn" aria-label="Open settings" aria-expanded="false" aria-haspopup="dialog">⚙️</button>
        <div id="settings-popover" class="settings-popover" role="dialog" aria-label="Settings" hidden></div>
      </div>
    </header>
```

- [ ] **Step 2: Replace the grid CSS block**

In `playground/style.css`, locate the `.grid { … }` rule and the `.region-*` / `.resizer-*` rules (roughly lines 42–95 based on the current file). Replace them with the following single block:

```css
header {
  margin-bottom: 1rem;
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.header-main {
  flex: 1 1 auto;
  min-width: 0;
}
.header-actions {
  position: relative;
  flex: 0 0 auto;
}
.settings-btn {
  background: transparent;
  border: 1px solid rgba(127, 127, 127, 0.3);
  color: inherit;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0.35rem 0.5rem;
  border-radius: 0.35rem;
}
.settings-btn:hover {
  background: rgba(127, 127, 127, 0.12);
}
.settings-popover {
  position: absolute;
  top: calc(100% + 0.4rem);
  right: 0;
  min-width: 260px;
  max-width: 320px;
  background: Canvas;
  color: CanvasText;
  border: 1px solid rgba(127, 127, 127, 0.35);
  border-radius: 0.5rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  padding: 0.75rem;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.settings-popover[hidden] {
  display: none;
}
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.settings-section h3 {
  margin: 0;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.65;
}
.settings-layout-presets {
  display: flex;
  gap: 0.35rem;
}
.settings-layout-presets button {
  flex: 1;
  padding: 0.35rem 0.4rem;
  border: 1px solid rgba(127, 127, 127, 0.3);
  background: transparent;
  color: inherit;
  border-radius: 0.35rem;
  cursor: pointer;
  font-size: 0.8rem;
}
.settings-layout-presets button[aria-pressed='true'] {
  background: rgba(100, 150, 255, 0.2);
  border-color: rgba(100, 150, 255, 0.6);
}
.settings-logout {
  background: rgba(220, 60, 60, 0.15);
  border: 1px solid rgba(220, 60, 60, 0.5);
  color: rgb(220, 60, 60);
  padding: 0.4rem 0.6rem;
  border-radius: 0.35rem;
  cursor: pointer;
  font-size: 0.85rem;
}
.settings-logout:hover {
  background: rgba(220, 60, 60, 0.25);
}

.grid {
  display: grid;
  gap: 0.5rem;
  flex: 1;
  min-height: 0;
}

.region {
  min-width: 0;
  min-height: 0;
}

.resizer {
  background: rgba(127, 127, 127, 0.25);
  border-radius: 3px;
  transition: background 120ms ease;
  user-select: none;
  touch-action: none;
}
.resizer:hover,
.resizer.dragging {
  background: rgba(100, 150, 255, 0.6);
}
.resizer.axis-row {
  cursor: row-resize;
}
.resizer.axis-col {
  cursor: col-resize;
}

/* ─── Preset: default (CHAT + AI on top row, UI fills bottom) ─── */
.grid[data-layout='default'] {
  grid-template-columns: minmax(160px, var(--col-chat, 1fr)) 6px minmax(160px, var(--col-ai, 1fr));
  grid-template-rows: minmax(80px, var(--row-top, 1fr)) 6px minmax(0, var(--row-ui, 3fr));
  grid-template-areas:
    'chat chat-ai ai'
    'top-bottom top-bottom top-bottom'
    'ui ui ui';
}
.grid[data-layout='default'] .region-chat { grid-area: chat; }
.grid[data-layout='default'] .region-ai { grid-area: ai; }
.grid[data-layout='default'] .region-ui { grid-area: ui; }
.grid[data-layout='default'] .resizer[data-pair='chat-ai'] { grid-area: chat-ai; }
.grid[data-layout='default'] .resizer[data-pair='top-bottom'] { grid-area: top-bottom; }
.grid[data-layout='default'] .resizer[data-pair='ai-ui'] { display: none; }

.grid[data-layout='default'][data-hide-ai] {
  grid-template-columns: 1fr;
  grid-template-rows: minmax(80px, var(--row-top, 1fr)) 6px minmax(0, var(--row-ui, 3fr));
  grid-template-areas:
    'chat'
    'top-bottom'
    'ui';
}
.grid[data-layout='default'][data-hide-ai] .region-ai,
.grid[data-layout='default'][data-hide-ai] .resizer[data-pair='chat-ai'] { display: none; }

/* ─── Preset: sideBySide (CHAT | AI | UI in one row) ─── */
.grid[data-layout='sideBySide'] {
  grid-template-rows: 1fr;
  grid-template-columns:
    minmax(160px, var(--col-chat, 1fr))
    6px
    minmax(160px, var(--col-ai, 1fr))
    6px
    minmax(160px, var(--col-ui, 1fr));
  grid-template-areas: 'chat chat-ai ai ai-ui ui';
}
.grid[data-layout='sideBySide'] .region-chat { grid-area: chat; }
.grid[data-layout='sideBySide'] .region-ai { grid-area: ai; }
.grid[data-layout='sideBySide'] .region-ui { grid-area: ui; }
.grid[data-layout='sideBySide'] .resizer[data-pair='chat-ai'] { grid-area: chat-ai; }
.grid[data-layout='sideBySide'] .resizer[data-pair='ai-ui'] { grid-area: ai-ui; }
.grid[data-layout='sideBySide'] .resizer[data-pair='top-bottom'] { display: none; }

.grid[data-layout='sideBySide'][data-hide-ai] {
  grid-template-columns:
    minmax(160px, var(--col-chat, 1fr))
    6px
    minmax(160px, var(--col-ui, 1fr));
  grid-template-areas: 'chat chat-ai ui';
}
.grid[data-layout='sideBySide'][data-hide-ai] .region-ai,
.grid[data-layout='sideBySide'][data-hide-ai] .resizer[data-pair='ai-ui'] { display: none; }
.grid[data-layout='sideBySide'][data-hide-ai] .resizer[data-pair='chat-ai'] { grid-area: chat-ai; }

/* ─── Preset: stacked (CHAT / AI / UI in one column) ─── */
.grid[data-layout='stacked'] {
  grid-template-columns: 1fr;
  grid-template-rows:
    minmax(80px, var(--row-chat, 1fr))
    6px
    minmax(80px, var(--row-ai, 1fr))
    6px
    minmax(80px, var(--row-ui, 1fr));
  grid-template-areas:
    'chat'
    'chat-ai'
    'ai'
    'ai-ui'
    'ui';
}
.grid[data-layout='stacked'] .region-chat { grid-area: chat; }
.grid[data-layout='stacked'] .region-ai { grid-area: ai; }
.grid[data-layout='stacked'] .region-ui { grid-area: ui; }
.grid[data-layout='stacked'] .resizer[data-pair='chat-ai'] { grid-area: chat-ai; }
.grid[data-layout='stacked'] .resizer[data-pair='ai-ui'] { grid-area: ai-ui; }
.grid[data-layout='stacked'] .resizer[data-pair='top-bottom'] { display: none; }

.grid[data-layout='stacked'][data-hide-ai] {
  grid-template-rows:
    minmax(80px, var(--row-chat, 1fr))
    6px
    minmax(80px, var(--row-ui, 1fr));
  grid-template-areas:
    'chat'
    'chat-ai'
    'ui';
}
.grid[data-layout='stacked'][data-hide-ai] .region-ai,
.grid[data-layout='stacked'][data-hide-ai] .resizer[data-pair='ai-ui'] { display: none; }
```

- [ ] **Step 3: Open the playground and confirm default layout still renders**

Start the preview server if not running, navigate to the playground, confirm three panels + two resizers render as before. (JS still uses old resize logic at this point — resize may misbehave until Task 7. Visual confirmation is enough here.)

- [ ] **Step 4: Commit**

```bash
git add playground/index.html playground/style.css
git commit -m "feat(playground): grid + CSS presets and gear/popover scaffolding"
```

---

## Task 7: Client layout engine + per-preset resize

**Files:**
- Modify: `playground/main.ts:129-265` (the panel-resizing section)

- [ ] **Step 1: Delete the old resize code**

In `playground/main.ts`, delete the entire block starting at the comment `// ─── panel resizing ─────────────────────────────────────────────────────` down to the closing `}` that ends the `if (grid) { … }` block. This removes:

- The `PANEL_SIZES_KEY`, `MIN_PANEL_PX`, and `PanelSizes` type
- `loadPanelSizes`, `applyPanelSizes`, `savePanelSizes`, `measurePanelSizes`, `clampPair`
- The `if (grid) { … }` that wires pointer handlers

Leave the preceding `const grid = document.getElementById('grid') as HTMLDivElement | null` line in place.

- [ ] **Step 2: Add the new layout engine**

Immediately after the `const grid = …` line, insert:

```ts
import {
  type LayoutPreset,
  type ResizerPair,
  readSettings,
  writeSettings,
} from './settings'

const MIN_FRACTION = 0.08

type Axis = 'row' | 'col'

// For each preset, declare which pair each resizer controls and on what axis.
const PAIR_AXIS: Record<LayoutPreset, Partial<Record<ResizerPair, Axis>>> = {
  default: { 'chat-ai': 'col', 'top-bottom': 'row' },
  sideBySide: { 'chat-ai': 'col', 'ai-ui': 'col' },
  stacked: { 'chat-ai': 'row', 'ai-ui': 'row' },
}

// For each pair on each preset, list the two CSS custom-property track names
// (first + second region) that participate in the drag.
const PAIR_TRACKS: Record<LayoutPreset, Partial<Record<ResizerPair, [string, string]>>> = {
  default: {
    'chat-ai': ['--col-chat', '--col-ai'],
    'top-bottom': ['--row-top', '--row-ui'],
  },
  sideBySide: {
    'chat-ai': ['--col-chat', '--col-ai'],
    'ai-ui': ['--col-ai', '--col-ui'],
  },
  stacked: {
    'chat-ai': ['--row-chat', '--row-ai'],
    'ai-ui': ['--row-ai', '--row-ui'],
  },
}

// Which two regions (by CSS class fragment) each pair resizes.
const PAIR_REGIONS: Record<ResizerPair, [string, string]> = {
  'chat-ai': ['region-chat', 'region-ai'],
  'ai-ui': ['region-ai', 'region-ui'],
  'top-bottom': ['region-chat', 'region-ui'], // "top" is chat row, "bottom" is ui
}

function applyLayout(g: HTMLDivElement): void {
  const s = readSettings()
  g.dataset.layout = s.layout
  if (s.hideAI) g.dataset.hideAi = ''
  else delete g.dataset.hideAi

  // apply sizes as CSS custom properties (fractions as fr)
  const saved = s.sizes[s.layout]
  const axisMap = PAIR_AXIS[s.layout]
  for (const [pair, tracks] of Object.entries(PAIR_TRACKS[s.layout]) as [
    ResizerPair,
    [string, string],
  ][]) {
    const v = saved[pair]
    if (typeof v === 'number' && v > 0 && v < 1) {
      g.style.setProperty(tracks[0], `${v}fr`)
      g.style.setProperty(tracks[1], `${1 - v}fr`)
    } else {
      g.style.removeProperty(tracks[0])
      g.style.removeProperty(tracks[1])
    }
  }

  // axis classes on resizers (used only for cursor styling; CSS handles display)
  for (const r of g.querySelectorAll<HTMLDivElement>('.resizer')) {
    const pair = r.dataset.pair as ResizerPair | undefined
    r.classList.remove('axis-row', 'axis-col')
    if (!pair) continue
    const axis = axisMap[pair]
    if (axis) r.classList.add(`axis-${axis}`)
  }
}

function wireResizers(g: HTMLDivElement): void {
  for (const resizer of g.querySelectorAll<HTMLDivElement>('.resizer')) {
    resizer.addEventListener('pointerdown', (e) => {
      const pair = resizer.dataset.pair as ResizerPair | undefined
      if (!pair) return
      const layout = (g.dataset.layout as LayoutPreset) ?? 'default'
      const axis = PAIR_AXIS[layout][pair]
      const tracks = PAIR_TRACKS[layout][pair]
      if (!axis || !tracks) return

      e.preventDefault()
      resizer.setPointerCapture(e.pointerId)
      resizer.classList.add('dragging')
      document.body.classList.add(axis === 'col' ? 'resizing-col' : 'resizing-row')

      const [firstClass, secondClass] = PAIR_REGIONS[pair]
      const first = g.querySelector<HTMLElement>(`.${firstClass}`)
      const second = g.querySelector<HTMLElement>(`.${secondClass}`)
      if (!first || !second) return

      const firstRect = first.getBoundingClientRect()
      const secondRect = second.getBoundingClientRect()
      const totalPx =
        axis === 'col' ? firstRect.width + secondRect.width : firstRect.height + secondRect.height
      const startFirstPx = axis === 'col' ? firstRect.width : firstRect.height
      const startCoord = axis === 'col' ? e.clientX : e.clientY

      const onMove = (ev: PointerEvent) => {
        const coord = axis === 'col' ? ev.clientX : ev.clientY
        const delta = coord - startCoord
        let nextFirst = (startFirstPx + delta) / totalPx
        nextFirst = Math.max(MIN_FRACTION, Math.min(1 - MIN_FRACTION, nextFirst))
        g.style.setProperty(tracks[0], `${nextFirst}fr`)
        g.style.setProperty(tracks[1], `${1 - nextFirst}fr`)
      }

      const onEnd = (ev: PointerEvent) => {
        resizer.releasePointerCapture(ev.pointerId)
        resizer.classList.remove('dragging')
        document.body.classList.remove('resizing-col', 'resizing-row')
        resizer.removeEventListener('pointermove', onMove)
        resizer.removeEventListener('pointerup', onEnd)
        resizer.removeEventListener('pointercancel', onEnd)

        // persist the final fraction
        const firstNow = (axis === 'col' ? first.getBoundingClientRect().width : first.getBoundingClientRect().height)
        const secondNow = (axis === 'col' ? second.getBoundingClientRect().width : second.getBoundingClientRect().height)
        const total = firstNow + secondNow
        if (total <= 0) return
        const fraction = firstNow / total
        writeSettings({ sizes: { [layout]: { [pair]: fraction } } })
      }

      resizer.addEventListener('pointermove', onMove)
      resizer.addEventListener('pointerup', onEnd)
      resizer.addEventListener('pointercancel', onEnd)
    })
  }
}

if (grid) {
  applyLayout(grid)
  wireResizers(grid)
}
```

(Move the `import { … } from './settings'` statement to the top of the file next to the existing imports — TypeScript requires imports at the top. Keep the rest of the block inline in place of the deleted resize code.)

- [ ] **Step 3: Verify typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: both pass.

- [ ] **Step 4: Preview the playground**

Start preview if needed, load the page, drag both resizers in the default preset, reload, confirm sizes persisted. Open devtools → Application → Local Storage → inspect `sui.layout.sizes.default` for the fractions.

- [ ] **Step 5: Commit**

```bash
git add playground/main.ts
git commit -m "feat(playground): layout engine with per-preset resizers"
```

---

## Task 8: Settings popover UI

**Files:**
- Create: `playground/settings-ui.ts`
- Modify: `playground/main.ts` (add one-line mount call near the top-level bootstrap)

- [ ] **Step 1: Write the popover module**

Create `playground/settings-ui.ts`:

```ts
import {
  type LayoutPreset,
  LAYOUT_PRESETS,
  MODEL_PRESETS,
  clearSizes,
  readSettings,
  writeSettings,
} from './settings'

export type PopoverCallbacks = {
  onLayoutChange: () => void
  onLogout: () => void
}

const PRESET_LABELS: Record<LayoutPreset, string> = {
  default: 'Default',
  sideBySide: 'Side-by-side',
  stacked: 'Stacked',
}

export function mountSettingsPopover(
  btn: HTMLButtonElement,
  popover: HTMLDivElement,
  cb: PopoverCallbacks,
): void {
  render()

  btn.addEventListener('click', () => {
    const open = popover.hasAttribute('hidden')
    if (open) show()
    else hide()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !popover.hasAttribute('hidden')) hide()
  })

  document.addEventListener('pointerdown', (e) => {
    if (popover.hasAttribute('hidden')) return
    const target = e.target as Node
    if (popover.contains(target) || btn.contains(target)) return
    hide()
  })

  function show() {
    render()
    popover.removeAttribute('hidden')
    btn.setAttribute('aria-expanded', 'true')
  }

  function hide() {
    popover.setAttribute('hidden', '')
    btn.setAttribute('aria-expanded', 'false')
  }

  function render() {
    const s = readSettings()
    const isCustomModel = !MODEL_PRESETS.includes(s.model)
    popover.replaceChildren(
      section('Model', [modelSelect(s.model, isCustomModel), customModelInput(s.model, isCustomModel)]),
      section('Layout', [presetRow(s.layout), hideAIRow(s.hideAI), resetSizesRow(s.layout)]),
      section('Account', [logoutRow()]),
    )
  }

  function section(title: string, children: HTMLElement[]): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'settings-section'
    const h = document.createElement('h3')
    h.textContent = title
    wrap.append(h, ...children)
    return wrap
  }

  function modelSelect(current: string, isCustom: boolean): HTMLElement {
    const sel = document.createElement('select')
    for (const m of MODEL_PRESETS) {
      const opt = document.createElement('option')
      opt.value = m
      opt.textContent = m
      if (!isCustom && m === current) opt.selected = true
      sel.appendChild(opt)
    }
    const customOpt = document.createElement('option')
    customOpt.value = '__custom__'
    customOpt.textContent = 'Custom…'
    if (isCustom) customOpt.selected = true
    sel.appendChild(customOpt)

    sel.addEventListener('change', () => {
      if (sel.value === '__custom__') {
        writeSettings({ model: current || '' })
      } else {
        writeSettings({ model: sel.value })
      }
      render()
    })
    return sel
  }

  function customModelInput(current: string, isCustom: boolean): HTMLElement {
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'provider/model-slug'
    input.value = isCustom ? current : ''
    input.hidden = !isCustom
    input.addEventListener('input', () => {
      writeSettings({ model: input.value.trim() })
    })
    return input
  }

  function presetRow(current: LayoutPreset): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'settings-layout-presets'
    wrap.setAttribute('role', 'radiogroup')
    for (const p of LAYOUT_PRESETS) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = PRESET_LABELS[p]
      b.setAttribute('role', 'radio')
      b.setAttribute('aria-pressed', String(p === current))
      b.addEventListener('click', () => {
        writeSettings({ layout: p })
        render()
        cb.onLayoutChange()
      })
      wrap.appendChild(b)
    }
    return wrap
  }

  function hideAIRow(current: boolean): HTMLElement {
    const label = document.createElement('label')
    label.style.display = 'flex'
    label.style.alignItems = 'center'
    label.style.gap = '0.4rem'
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = current
    box.addEventListener('change', () => {
      writeSettings({ hideAI: box.checked })
      cb.onLayoutChange()
    })
    const text = document.createElement('span')
    text.textContent = 'Hide AI panel'
    label.append(box, text)
    return label
  }

  function resetSizesRow(active: LayoutPreset): HTMLElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = `Reset sizes (${PRESET_LABELS[active]})`
    b.addEventListener('click', () => {
      clearSizes(active)
      cb.onLayoutChange()
    })
    return b
  }

  function logoutRow(): HTMLElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'settings-logout'
    b.textContent = 'Log out'
    b.title = 'You may need to close this tab in some browsers'
    b.addEventListener('click', () => cb.onLogout())
    return b
  }
}
```

- [ ] **Step 2: Mount the popover from `main.ts`**

`applyLayout` is file-local in `main.ts`, so `settings-ui.ts` gets re-apply behaviour via a callback. Add this wiring to `playground/main.ts`:

1. With the other top-of-file imports, add:

   ```ts
   import { mountSettingsPopover } from './settings-ui'
   ```

2. Directly after the `if (grid) { applyLayout(grid); wireResizers(grid) }` block from Task 7, append:

   ```ts
   function doLogout(): void {
     // implemented in Task 10
   }

   const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement | null
   const settingsPopover = document.getElementById('settings-popover') as HTMLDivElement | null
   if (settingsBtn && settingsPopover && grid) {
     mountSettingsPopover(settingsBtn, settingsPopover, {
       onLayoutChange: () => applyLayout(grid),
       onLogout: () => doLogout(),
     })
   }
   ```

- [ ] **Step 3: Typecheck and lint**

Run: `bun run typecheck && bun run lint`
Expected: both pass.

- [ ] **Step 4: Preview verification**

- Click ⚙️ — popover opens.
- Click outside — closes.
- Press Esc — closes.
- Switch between Default / Side-by-side / Stacked — grid updates live.
- Toggle "Hide AI panel" — AI region hides; preset adapts.
- Drag a resizer in each preset; reload; sizes persist per preset (check `sui.layout.sizes.*`).
- Click "Reset sizes" — active preset's sizes clear, reverts to CSS defaults.
- Select "openai/gpt-5" — verify `sui.model` updates in localStorage.
- Select "Custom…" — text input appears, type a slug — verify `sui.model` updates.

Take a screenshot via the preview tools for the record.

- [ ] **Step 5: Commit**

```bash
git add playground/settings-ui.ts playground/main.ts
git commit -m "feat(playground): settings popover (model, layout, logout)"
```

---

## Task 9: Send model in `/api/agent` requests

**Files:**
- Modify: `playground/main.ts:750` (the `realAgent` fetch body)

- [ ] **Step 1: Include `model` in the POST body**

In `playground/main.ts`, inside `async function* realAgent(msgs: PlaygroundMessage[])`, replace:

```ts
    response = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs }),
    })
```

with:

```ts
    const { model } = readSettings()
    response = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs, model }),
    })
```

(`readSettings` is already imported in Task 7.)

- [ ] **Step 2: Preview end-to-end**

Start the full playground (`bun run playground:full`) with a valid `AI_GATEWAY_API_KEY`. Pick a non-default model in the popover, send a prompt, confirm the response and that the network tab's POST body includes `"model":"openai/gpt-5"` (or whichever you picked).

- [ ] **Step 3: Commit**

```bash
git add playground/main.ts
git commit -m "feat(playground): include chosen model in agent requests"
```

---

## Task 10: Wire the Logout button

**Files:**
- Modify: `playground/main.ts` (the `doLogout` placeholder from Task 8)

- [ ] **Step 1: Implement `doLogout`**

Replace the `doLogout` placeholder added in Task 8 with:

```ts
async function doLogout(): Promise<void> {
  try {
    await fetch('/api/logout', { method: 'POST', cache: 'no-store' })
  } catch {
    // ignore — we still want to reload
  }
  try {
    // Poison Chrome's cached Basic Auth creds: a request with bogus creds
    // replaces the cache entry so the next navigation re-prompts.
    await fetch('/', {
      method: 'GET',
      cache: 'no-store',
      headers: { Authorization: `Basic ${btoa('logout:logout')}` },
    })
  } catch {
    // ignore
  }
  window.location.reload()
}
```

- [ ] **Step 2: Preview the flow**

In a test deployment with `BASIC_AUTH_PASS` set:
- Log in.
- Open ⚙️, click "Log out".
- Browser should re-prompt for Basic Auth credentials.

If running locally without Basic Auth (no `BASIC_AUTH_PASS`), the middleware is a no-op; the reload still happens but no re-prompt — that's expected. Confirm at minimum that `/api/logout` returns 401 and the page reloads.

- [ ] **Step 3: Commit**

```bash
git add playground/main.ts
git commit -m "feat(playground): log out via 401 + cache-poison + reload"
```

---

## Task 11: Ship gate

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `bun run lint`
Expected: passes. If biome flags style issues, run `bun run format` and re-lint.

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: passes.

- [ ] **Step 3: Tests**

Run: `bun run test`
Expected: every suite passes, including new `playground/settings.test.ts` and `api/model.test.ts`.

- [ ] **Step 4: Library build (unchanged, sanity check)**

Run: `bun run build`
Expected: `dist/` rebuilds cleanly.

- [ ] **Step 5: Playground build (final proof)**

Run: `bun run playground:build`
Expected: vite produces `playground/dist/` without errors or warnings related to the new code.

- [ ] **Step 6: Final commit (only if format/build produced incidental changes)**

```bash
git status
# If anything is modified:
git add -A
git commit -m "chore: format and build artifacts from settings/logout feature"
```
