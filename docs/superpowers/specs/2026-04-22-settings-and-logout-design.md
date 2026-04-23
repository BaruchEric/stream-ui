# Settings Gear and Logout — Design

**Date:** 2026-04-22
**Scope:** Playground UI (`playground/`) plus two small server additions (`api/agent.ts`, new `api/logout.ts`).

## Goal

Add a settings gear to the playground header that opens a popover with three sections:

1. **Model** — pick the LLM used by the real-agent backend.
2. **Layout** — switch between three layout presets, toggle the AI panel, reset panel sizes.
3. **Account** — log out of HTTP Basic Auth.

All preferences persist in `localStorage`. The current playground UX (three panels, drag-to-resize, real/mock agent fallback) is preserved; the settings popover augments it.

## Non-goals

- Theming / dark mode toggle (playground is already single-theme).
- Per-preset layout editors beyond the preset + resize controls described here.
- Server-side user accounts. Auth stays HTTP Basic via the existing middleware.
- Broadening the model picker into a capability matrix (cost, latency, vision, etc.) — just slugs.

## User-facing behavior

### Settings gear

- A ⚙️ button is added to the playground header, top-right. Accessible via keyboard (`button type="button"`, focusable, `aria-label="Open settings"`, `aria-expanded` reflects popover state).
- Clicking opens a popover anchored to the gear. Click outside, press `Esc`, or click the gear again closes it.
- The popover is rendered as a sibling of the gear (not inside a modal layer) so it uses CSS for positioning (`position: absolute; top: 100%; right: 0`).

### Popover: Model section

- Section heading: "Model".
- `<select>` of curated gateway slugs:
  - `anthropic/claude-sonnet-4-6` (default)
  - `anthropic/claude-opus-4-7`
  - `anthropic/claude-haiku-4-5`
  - `openai/gpt-5`
  - `openai/gpt-4o`
  - `google/gemini-2.5-pro`
  - `Custom…` (sentinel value)
- When `Custom…` is selected, a text input appears below the select with placeholder `provider/model-slug`.
- On change, the new value is written to `localStorage["sui.model"]` and used for subsequent `/api/agent` requests.
- No explicit "Save" button — edits apply live.

### Popover: Layout section

- Section heading: "Layout".
- Three radio-styled buttons (`role="radiogroup"`) labeled **Default**, **Side-by-side**, **Stacked**. The active preset is visibly selected.
- Toggle checkbox: **Hide AI panel**.
- Button: **Reset sizes** — clears `localStorage["sui.layout.sizes.<active-preset>"]` and snaps the grid back to CSS defaults.

Preset shapes (also documented in the popover via a small legend or just the icon):

- **Default** — CSS grid `grid-template-columns: 1fr auto 1fr; grid-template-rows: 1fr auto 1fr;`. CHAT + vertical resizer + AI on row 1. Horizontal resizer on row 2. UI spans both columns on row 3. (Today's layout.)
- **Side-by-side** — single row: `grid-template-columns: 1fr auto 1fr auto 1fr; grid-template-rows: 1fr;`. CHAT | v-resizer | AI | v-resizer | UI.
- **Stacked** — single column: `grid-template-rows: 1fr auto 1fr auto 1fr; grid-template-columns: 1fr;`. CHAT — h-resizer — AI — h-resizer — UI.

**Hide AI panel** adjusts each preset:

- **Default** + hide → CHAT spans full top row; horizontal resizer between top (CHAT) and bottom (UI).
- **Side-by-side** + hide → CHAT | v-resizer | UI (one resizer).
- **Stacked** + hide → CHAT — h-resizer — UI.

### Popover: Account section

- Section heading: "Account".
- **Log out** button, styled red (destructive variant).
- On click:
  1. `POST /api/logout` → server returns 401.
  2. `fetch('/', { headers: { Authorization: 'Basic ' + btoa('logout:logout') }, cache: 'no-store' })` to poison Chrome's cached creds (ignore response).
  3. `window.location.reload()`. Middleware will re-issue the `WWW-Authenticate` challenge.

## Architecture

### DOM changes (`playground/index.html`)

- Header gains a right-aligned container with the gear button and the popover root.
- The `#grid` element gets three new attributes driven by JS: `data-layout`, `data-hide-ai` (presence = hidden). A single set of panels + resizers lives in the DOM:

  ```html
  <div class="grid" id="grid" data-layout="default">
    <section class="region region-chat">…</section>
    <div class="resizer" data-pair="chat-ai"></div>
    <section class="region region-ai">…</section>
    <div class="resizer" data-pair="ai-ui"></div>
    <section class="region region-ui">…</section>
    <div class="resizer" data-pair="top-bottom"></div>
  </div>
  ```

  CSS picks which resizers are shown and what orientation they have based on `data-layout` and `data-hide-ai`. Implementation detail: the exact resizer set per preset is chosen in CSS, not JS, so the DOM stays stable.

### CSS (`playground/style.css`)

- One selector block per `data-layout` value. Each block sets `grid-template-rows/columns`, `grid-area` on each region, and `display: none` on resizers that don't apply to that layout.
- `data-hide-ai` selectors override the above to remove the AI region and adjust the template.
- Existing `.resizer-v` / `.resizer-h` visual styles remain; the orientation class is set dynamically by JS when the layout changes (since a given `.resizer` element serves different axes in different presets).

### JavaScript (`playground/main.ts`)

A new small module-scope module, `settings.ts` (or inline section of `main.ts` if it stays short), owns:

- `readSettings()` / `writeSettings(patch)` — typed wrapper over `localStorage` with a single `SuiSettings` shape.
- `applyLayout(settings)` — mutates `#grid` attributes, updates resizer orientation classes, applies stored sizes for the active preset.
- `mountSettingsPopover()` — builds the DOM for the gear + popover, wires change handlers, handles Esc/outside-click.
- `getActiveModel()` — reads `localStorage["sui.model"]` with fallback to default.

The resize logic in `main.ts` generalizes to: for a given `.resizer[data-pair]`, find its two adjacent `.region` siblings, track drag, write the resulting fractional size (`flex-basis` or grid-track size in `fr`) into `localStorage["sui.layout.sizes.<preset>"]` keyed by pair.

### Server (`api/agent.ts`)

- Parse `model` from the POST body:

  ```ts
  const clientModel =
    typeof body.model === 'string' && /^[\w.-]+\/[\w.-]+$/.test(body.model)
      ? body.model
      : undefined
  const model = clientModel ?? process.env.AI_MODEL ?? 'anthropic/claude-sonnet-4-6'
  ```
- Pass `model` to `streamText({ model, … })`.
- No change to the streaming/tools/SSE logic.

### Server (`api/logout.ts` — new)

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('WWW-Authenticate', 'Basic realm="stream-ui playground"')
  res.status(401).send('Logged out')
}
```

No changes required in `middleware.ts` — it already enforces Basic Auth on `/api/*`.

## Data model

### `localStorage` schema (namespace `sui.*`)

| Key                             | Type                                      | Default                     |
| ------------------------------- | ----------------------------------------- | --------------------------- |
| `sui.model`                     | string                                    | `"anthropic/claude-sonnet-4-6"` |
| `sui.layout.preset`             | `"default" \| "sideBySide" \| "stacked"`   | `"default"`                 |
| `sui.layout.hideAI`             | `"true" \| "false"`                       | `"false"`                   |
| `sui.layout.sizes.default`      | JSON `{ "chat-ai": number, "top-bottom": number }` | absent (use CSS defaults) |
| `sui.layout.sizes.sideBySide`   | JSON `{ "chat-ai": number, "ai-ui": number }`      | absent |
| `sui.layout.sizes.stacked`      | JSON `{ "chat-ai": number, "ai-ui": number }`      | absent |

Sizes are stored as fractional values (e.g. `0.42`) representing the first region's share of its track. The resize handler converts drag deltas to fractions and writes back.

### Request body to `/api/agent`

Existing fields unchanged. Add optional:

```ts
{ messages: PlaygroundMessage[], model?: string }
```

## Error handling

- Invalid custom model slug (fails the regex): the client accepts it in the input (so the user can finish typing) but the server silently falls back to the env default. The client shows a small inline error next to the text input on the *response* path (simplest: after a failed stream, show "Unknown model" under the input — deferred if complex).
- `localStorage` unavailable (private mode, quota): settings module catches and returns defaults. The popover still works; just doesn't persist.
- Logout fetch failures: the poison-creds fetch is best-effort; if it throws, still proceed to reload.

## Testing

Existing test setup: `bun test`. No new unit test infrastructure. Cover:

- `settings.ts`:
  - `readSettings` returns defaults when localStorage is empty.
  - `writeSettings` round-trips values.
  - `readSettings` tolerates corrupt JSON in size keys (falls back to `{}`).
- `api/agent.ts`:
  - Request with valid `model` uses it.
  - Request with malformed `model` falls back to env/default.
  - Existing tests (if any) keep passing.
- Manual / preview-tool verification after implementation:
  - Open the playground, verify gear appears, popover opens/closes on click and Esc.
  - Switch each preset; drag a resizer; reload; verify sizes persist per preset.
  - Select a non-default model; trigger a prompt; verify request body contains `model`.
  - Click Log out; verify the browser re-prompts for Basic Auth.

## Open risks

- **Chrome Basic Auth cache is stubborn.** The poison-fetch trick works in most Chrome versions but is not standardized. If it fails on a specific version, the fallback is "close the tab" — documented in the popover as hover text on the Log out button (`title="You may need to close this tab in some browsers"`).
- **Layout presets change CSS grid areas.** Done wrong, this creates invisible panels or broken resizers. Keep each preset's selector block self-contained, don't share `.region` rules across presets except for styling that's truly layout-independent.
- **Model slug validation is optimistic.** The regex is permissive on purpose — new providers come and go. Stricter validation is deferred to real failure signals from the AI SDK.

## Out of scope (explicitly)

- Saving *preset-specific* hide-AI state. Hide-AI is a single boolean that applies across presets.
- Animating the popover open/close beyond a fast CSS transition.
- Mobile layout considerations for the popover.
- Rendering a "you are logged out" splash — relying on the browser's built-in Basic Auth prompt is good enough for a playground.
