# stream-ui — Session Handoff

> **Date:** 2026-04-18 · **Author:** Eric (with Claude) · **Repo state:** [`a96c6bd`](https://github.com/BaruchEric/stream-ui/commit/a96c6bd) on `main` · **Version:** 0.4.0 · **Status:** alive in playground, not yet deployed/published.

This doc reads cold. If you've never seen this repo: read TL;DR → Quick start → Files to know. If you're picking up where we stopped: jump to **Concerns** then **Next steps**.

---

## TL;DR

stream-ui is a JSON-spec → DOM framework with a registry-based extension model, built so an AI agent can stream UI fragments to a user as easily as it streams text. In one session we shipped four versions:

- **v0.1.0** — `render`/`append`/`clear` + 5 starter components
- **v0.2.0** — 20 standard components + `palette` demo
- **v0.3.0** — recursive composition (`stack`/`row`/`grid` + `card.children`)
- **v0.4.0** — registry-based extensibility; `register(kind, fn)` lets consumers add their own kinds; built-ins exposed as a typed `builtins.<kind>` map for direct invocation without the registry

The framework is intentionally agent-agnostic: agent → JSON spec → registry dispatch → DOM. Every renderer is a pure `(spec, onAction?) => HTMLElement` and works on its own.

What's still missing: a real LLM (the playground agent is keyword-routed mock), reactive in-place updates (every `render()` replaces), a license, an npm publish, DOM-level tests, and an a11y pass.

---

## Where we are

| Thing | Value |
|---|---|
| GitHub | [BaruchEric/stream-ui](https://github.com/BaruchEric/stream-ui) (public, MIT-able OSS-aspiring) |
| Local path | [stream-ui](/Users/ericbaruch/Arik/dev/stream-ui) (sibling of lumina) |
| Latest commit | [`a96c6bd`](https://github.com/BaruchEric/stream-ui/commit/a96c6bd) — registry refactor |
| Version | 0.4.0 (`package.json` + `src/index.ts` `VERSION`) |
| License | `UNLICENSED` (deferred — must pick before anyone outside Eric uses it) |
| Built artifact | `dist/index.js` 11.73 KB ESM + `dist/index.d.ts` 4.88 KB |
| CI | GitHub Actions, lint→typecheck→test→build, [`ci.yml`](.github/workflows/ci.yml) |
| Tests | 6 passing (`src/index.test.ts`) — type/registry only, **no DOM** |
| Playground | local-only at `http://localhost:5173` via `bun run playground` |
| Topics | `agent-tools`, `ai`, `ai-agent`, `bun`, `framework`, `generative-ui`, `streaming`, `typescript`, `ui` |

### What works today (verified in browser)

- 23 built-in component kinds render correctly via `palette` command
- Recursive composition: card containing row of badges + row of buttons
- Custom registration: `kanban-card` registered in `playground/main.ts`, agent emits `{ kind: 'kanban-card', ... }`, framework dispatches; click action loops back to CHAT/AI
- Mock agent recognizes ~20 keywords + special commands (`palette`, `clear`, `add` for append-mode)
- Closed loop: human prompt → mock agent → AI reasoning stream → rendered UI → user action → action event back to CHAT/AI

---

## Concerns (ranked by sharpness)

### 🔴 Critical — fix before anyone else uses this

1. **License is `UNLICENSED`.** GitHub treats this as "all rights reserved." A public repo with no license can be read but not legally reused. **Pick MIT, Apache-2.0, or MPL-2.0** before sharing the URL with collaborators. Adding the file is a 1-minute task once decided.

2. **Inputs lose focus on `render()`.** `container.replaceChildren(...)` destroys the entire subtree. If the agent re-renders while the user is typing in an input, focus + selection + IME state are lost. This makes the framework unusable for any non-trivial input flow. **Mitigations**: preserve focus path before replace + restore after; or move to a diff/patch update model (see Next Steps #8).

3. **Image/link `src`/`href` not validated.** `el.src = spec.src` and `el.href = spec.href` directly assign agent-controlled strings. No scheme allowlist, no XSS check. A misaligned agent (or a prompt-injected one) could inject `javascript:` URLs or beacon trackers. **Add at minimum**: scheme allowlist (`http`, `https`, `data:image/...`) + warn-on-mismatch.

### 🟡 Real — should fix soon

4. **No DOM tests.** Vitest runs in node env. Current tests only verify type discrimination + registry plumbing. The `createElement` dispatch is fully untested at the rendering layer. **Fix**: add `happy-dom` (lighter than jsdom), set `vitest.config.ts` `environment: 'happy-dom'`, write a smoke test per kind that asserts the tag name + key attributes.

5. **No actual LLM.** The whole framing of the project — "guided by AI agent" — has not been demonstrated against a real model. The playground agent is keyword routing. **Until we wire a real model**, we don't know if the spec shape is ergonomic for an LLM to generate, or if streaming behavior holds up under real latency.

6. **Custom kinds aren't part of `ComponentSpec`.** When users `register('foo', renderer)`, TypeScript doesn't know `foo` exists. Children arrays inside built-in containers can't include custom kinds with type safety (cast to `AnySpec` works but isn't ergonomic). **Fix**: module augmentation pattern — let consumers `declare module 'stream-ui' { interface CustomComponentSpecs { 'foo': FooSpec } }` and synthesize the union.

7. **No state primitive / reactivity.** Every `render()` is a full re-mount of the target node. There's no way for the agent to say "update the progress bar value to 75%" without re-rendering the entire region. **Options**: (a) signal-based primitives that components subscribe to; (b) JSON-Patch protocol where the agent sends diffs; (c) a tiny diff/reconciler that compares old vs new spec trees and patches in place. Option (b) has lowest framework complexity.

### 🟠 Annoying — clean up when you have a moment

8. **Agent's `extractAfter` regex is greedy.** "make a button labeled Run" → label "labeled Run" instead of "Run". Symptom of pushing keyword routing past its limit. Will go away once a real LLM emits structured specs.

9. **Built-in styles live in playground CSS.** The `.sui-*` classes that the framework's components use are defined in `playground/style.css`. A consumer of the npm package gets the JS but no CSS — components render unstyled. **Fix options**: ship a `dist/styles.css`, inline minimal styles, or use shadow DOM / CSS-in-JS. The "framework includes minimal default CSS" path is most agent-friendly.

10. **Forms use nested `<label><input/></label>` instead of `for`/`id`.** Works for screen readers but explicit `for`/`id` association is more robust and required by some accessibility audits. Pair check: ensure unique `id`s per render to avoid DOM collisions when same form spec renders twice.

11. **No bundle size budget / tracking.** Started at 0.5 KB → 2.5 KB → 10.3 KB → 11.7 KB across the four versions. No alerting if it doubles. **Fix**: add a simple size check to CI (`bunx size-limit` or a script that reads `dist/index.js` size and asserts `< N`).

12. **`vite` is a heavy devDep.** The library itself is 12 KB, but `vite` adds ~100 MB to `node_modules`. Acceptable for a dev tool, but if we want truly fast `npm install`, consider extracting the playground into its own subpackage / workspace.

13. **vitest 2.x vs 3.x.** `package.json` says `"vitest": "^2.0.0"` (resolves 2.1.9). Vitest 3 ships `--coverage` improvements and faster startup; not a blocker but worth a deliberate upgrade decision.

14. **No published npm artifact.** `bun add stream-ui` will fail. The README documents an install command that doesn't work yet. **Fix**: decide name (`stream-ui` if available, `@baruch-eric/stream-ui` otherwise) → add `publishConfig` → `npm publish` (or set up GH Packages / JSR).

### 🟢 Cosmetic / future

15. **No README badges** (npm version, CI status, license, downloads). Adds at-a-glance signal.
16. **No CHANGELOG.md.** Commit log captures changes but a curated CHANGELOG helps consumers track API shifts.
17. **No `examples/` folder.** The custom-kind demo lives in `playground/main.ts`. New users have to scrape playground code to learn the registry API.
18. **`AgentEvent` type lives in `types.ts` but no helper consumes it.** The mock agent in playground re-declares its own. Either ship a `consumeStream(asyncIterable, container)` helper or remove the type from public exports.
19. **`.claude/launch.json` exists in stream-ui** — good for future Claude Code sessions opening this repo. Lumina's `.claude/launch.json` ALSO has a `stream-ui-playground` entry that hard-codes the absolute path to stream-ui — that change is uncommitted in lumina (out of scope for this session).

---

## Next steps (ranked, with effort hints)

### MUST — before this is real

1. **Pick a license** (5 min). MIT default if undecided.
2. **Real LLM swap-in** (~3-5 hours). Steps:
   - Add a small bun server alongside vite (or put it in `playground/server.ts`) that exposes `POST /api/agent` and uses Vercel AI Gateway via `"provider/model"` strings + AI SDK 6 tool calling. The "tool" the model calls is `render(spec)` — model emits structured `ComponentSpec` JSON.
   - System prompt includes `JSON.stringify(listKinds())` so the model knows what kinds exist.
   - Stream tool-call results back to the playground via SSE; playground forwards to the existing mock agent loop (just swap the iterator source).
   - Need an env var (`AI_GATEWAY_API_KEY` likely) — store in `.env.local`, gitignored.
3. **Fix focus loss on re-render** (~1 hour). At minimum: capture `document.activeElement.id` + selection range before `replaceChildren`, restore after if the new tree contains a node with the same id.

### SHOULD — within the next 1-2 sessions

4. **DOM tests via happy-dom** (~1 hour). One smoke test per built-in: assert tag name, presence of label text, action callback fires.
5. **A11y pass** (~2 hours). `for`/`id` pairs, role/aria audit, focus order in form, color contrast on alert/badge variants in light AND dark themes.
6. **Module augmentation for custom kinds** (~1 hour). Update `ComponentSpec` to be `BuiltinSpec | CustomComponentSpecs[keyof CustomComponentSpecs]` where `CustomComponentSpecs` is empty and extension-augmentable.
7. **Publish to npm** (~30 min). Pick name, write CHANGELOG, `npm publish --access public`. Set up auto-publish on tag push via GH Actions.
8. **Reactive updates** (~4-8 hours). Decision: signals vs JSON-Patch vs reconciler. Recommendation: JSON-Patch — small wire format, the framework just applies patches to current spec tree + re-renders affected subtrees. Agent can stream patches between full renders.
9. **Ship default styles** (~1 hour). Move `.sui-*` rules from `playground/style.css` into `dist/styles.css`. Document `import 'stream-ui/styles.css'` in the README.

### COULD — polish + demos

10. **More kinds**: `dialog`, `modal`, `tabs`, `accordion`, `chart` (sparkline → line/bar SVG), `toast`, `markdown` (with safe parser), `kbd`, `quote`, `details`.
11. **Theming layer** — CSS variables (`--sui-color-primary`, `--sui-radius-md`, etc.) so the agent can switch themes via `{ kind: 'set-theme', name: 'dark' }`.
12. **Component palette dock in playground** — sidebar with pre-made specs the human can drop into the UI region. Useful for designing UIs to feed back to the agent.
13. **Persist session** — chat history + UI state to `localStorage` so refresh doesn't blow away context.
14. **Auto-generate JSON Schema** from `ComponentSpec` (via `ts-json-schema-generator`). Schema becomes the agent's tool definition — single source of truth.
15. **CHANGELOG.md + release-please** — automated semantic versioning from conventional commits.

---

## Speculative / creative directions

These are 3-day-hack-or-maybe-a-startup ideas. Not all are good; some are great.

### 1. **Stream-ui as an MCP server**
Package the framework as an MCP server exposing `render_ui(spec, target)` as a tool. Then any Claude Code / Claude Desktop / Cursor session can drive a stream-ui surface on the user's machine without bespoke wiring. The "main user is agent" goal generalizes: every MCP-capable agent now has a UI primitive.

### 2. **Generative UI marketplace**
Community-published kind packages: `stream-ui-charts`, `stream-ui-3d`, `stream-ui-music`, `stream-ui-game-controls`. Each is an npm package that calls `register()` on import. The agent's tool schema dynamically lists all registered kinds. A long tail of domain-specific UI primitives, all driven by the same protocol.

### 3. **Differential streaming via JSON-Patch**
Instead of full specs, the agent emits RFC 6902 JSON Patches. The framework holds the current spec tree as state and applies patches. Tiny on the wire (modify one button label = ~30 bytes), enables true in-place updates, gives free time-travel debug.

### 4. **Time-travel UI debugger**
Record every `AgentEvent` to an in-memory ring buffer. Add a dev tool overlay that lets you scrub through history, replay sequences, and diff renders. Killer feature for debugging emergent agent behavior — you can SEE what the agent saw and what it produced.

### 5. **Form-as-API**
Reframe forms: when an agent renders a form, the form is implicitly an API the user fills in. The action callback returns structured payload back to the agent, which can continue planning. This pattern + good defaults could replace a lot of conversational back-and-forth ("what's your email?" → just render the input). Position the framework as "structured I/O for agents."

### 6. **Layout intelligence**
The agent decides *what* to render. The framework decides *how to lay it out* — responsive breakpoints, dense vs spacious, grouping logic. Could be rule-based or ML-driven. The idea: the agent shouldn't have to micromanage layout; the framework should be a smart layout engine that takes content hints.

### 7. **Multi-agent collaborative UI**
Multiple agents (or one agent + a human) writing to the same UI region simultaneously. CRDT for ComponentSpec. Conflict resolution = open research problem. Useful for: code review with AI co-author, multi-LLM consensus dashboards, agent swarms doing complementary tasks.

### 8. **Voice-to-UI**
Web Speech API → text → agent → UI. Demo: blind users navigate dynamic UIs by talking. Or: hands-free agent control for kitchens, garages, accessibility. Keyboard-free interaction at scale.

### 9. **Reverse-direction (UI sketches → agent prompts)**
Today: agent → JSON spec → DOM. What about: human sketches/drags components on a canvas → framework converts to ComponentSpec → sends to agent for refinement. UI as a *structured prompt format*. Whiteboard mode for AI brainstorming.

### 10. **Spec-to-screenshot pipeline**
Server-side render any ComponentSpec to PNG via Puppeteer / Playwright. Useful for: PR previews of agent-generated UIs, social media share images, A/B testing thumbnails. Spec → image as a service.

### 11. **A/B optimization loop**
Agent generates variant A and variant B of a UI for the same user goal. Framework tracks which gets engagement (clicks, completions, time-on-task). Built-in feedback loop for LLM-designed UIs to learn what works. Stream-ui ships with the loop; the agent grows better designs over time.

---

## Quick start for a fresh session

```bash
cd /Users/ericbaruch/Arik/dev/stream-ui
bun install

# Dev (in two terminals OR via Claude Code preview_start)
bun run playground   # vite dev server at :5173 — open in browser
bun run dev          # tsup watch mode — rebuild dist/ on src/ change

# Gates (run before commit)
bun run lint         # biome check
bun run typecheck    # tsc --noEmit
bun run test         # vitest
bun run build        # tsup → dist/

# In Claude Code (this works because .claude/launch.json is committed)
preview_start stream-ui-playground
```

Try in the playground:

- `palette` — renders one of every kind, including the composition demos
- `kanban Build registry feature, status doing` — fires the custom-registered kind
- `add a button labeled OK` — appends instead of replacing (the `add` keyword)
- `clear` — wipes the UI region

---

## Files to know

| File | What lives here |
|---|---|
| [`src/types.ts`](../src/types.ts) | Every built-in `ComponentSpec` kind, `Renderer<T>`, `ActionEvent`, `AgentEvent`, `AnySpec` |
| [`src/registry.ts`](../src/registry.ts) | `register`/`unregister`/`getRenderer`/`hasKind`/`listKinds` + low-level `createElement` (the dispatch heart) |
| [`src/components.ts`](../src/components.ts) | `builtins` map — one entry per built-in kind; recursive containers (card/stack/row/grid) call back into the registry |
| [`src/index.ts`](../src/index.ts) | Public API surface; auto-registers built-ins on import; defines `render`/`append`/`clear` convenience wrappers |
| [`src/index.test.ts`](../src/index.test.ts) | 6 vitest tests (types + registry plumbing only, no DOM) |
| [`playground/main.ts`](../playground/main.ts) | 3-pane wiring + mock keyword-routed agent + `kanban-card` custom-kind demo |
| [`playground/index.html`](../playground/index.html) | 3-pane layout: CHAT / AI / UI |
| [`playground/style.css`](../playground/style.css) | Playground chrome AND the `.sui-*` component styles (concern #9 — these need to ship with the framework) |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | Lint→typecheck→test→build on push/PR to main |
| [`.claude/launch.json`](../.claude/launch.json) | `stream-ui-playground` config so any Claude Code session can `preview_start` |
| [`README.md`](../README.md) | Public-facing API docs + usage examples + architecture summary |

---

## Open questions for the next session

1. **License** — MIT (default), Apache-2.0 (with patent grant), MPL-2.0 (file-level copyleft), or other?
2. **Publish to npm** — yes/no? If yes, what name? `stream-ui` is probably available; `@baruch-eric/stream-ui` is a safer scoped fallback.
3. **Real LLM next, or reactive updates next?** Both are big; pick the higher-value one for v0.5.
4. **If LLM next**: Vercel AI Gateway (per session-start guidance) or direct Anthropic SDK? Server lives where — bun process alongside vite, or a separate Vercel deployment?
5. **`agent-tools` framework family** — when do we scaffold the parent repo? (The original "let's talk about" intent flagged that stream-ui is meant to be one of many sibling tools.)
6. **Documentation site** — `docs/` folder + Vitepress / Astro Starlight, or stay README-only for now?
7. **Should the playground move to its own subpackage** so `npm install stream-ui` doesn't pull vite?

---

## Loose ends from this session

- **lumina** has uncommitted changes in [`.claude/launch.json`](/Users/ericbaruch/Arik/dev/lumina/.claude/launch.json) — added a `stream-ui-playground` entry pointing at the absolute path to stream-ui. Useful for working on stream-ui from within a lumina-rooted Claude session, but coupling lumina to stream-ui's location is questionable. Decide: commit (and accept that lumina's git history references a sibling repo's path), or revert (and rely on each repo's own `.claude/launch.json` after `cd`).
- **Memory updated** at [`feedback_ui_scaffold_playground.md`](/Users/ericbaruch/.claude/projects/-Users-ericbaruch-Arik-dev-lumina/memory/feedback_ui_scaffold_playground.md) — captures the lesson that UI libraries always need a browser playground in their initial scaffold (this came from being corrected mid-session when I dismissed preview as "not needed for a library"). Good general lesson, applies beyond stream-ui.
- **Preview server** is running on port 5173 (server id `1c25f64c-da51-4dfe-8222-d2e9fd28ad6b`). Will persist across this session unless explicitly stopped.
