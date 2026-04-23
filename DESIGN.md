---
version: alpha
name: Stream UI Default
description: Default theme for stream-ui — neutral, accessible, agent-friendly.
colors:
  primary: "#508CDC"
  primary-hover: "#5F9BEB"
  neutral: "#7F7F7F"
  success: "#50B464"
  warning: "#DCAA46"
  error: "#DC5A5A"
  link: "#6496FF"
  link-hover: "#82AFFF"
  on-primary: "#FFFFFF"
  on-error: "#FFFFFF"
typography:
  h1:
    fontFamily: inherit
    fontSize: 1.75rem
    lineHeight: 1.2
  h2:
    fontFamily: inherit
    fontSize: 1.4rem
    lineHeight: 1.2
  h3:
    fontFamily: inherit
    fontSize: 1.15rem
    lineHeight: 1.2
  body:
    fontFamily: inherit
    fontSize: 1rem
    lineHeight: 1.5
  small:
    fontFamily: inherit
    fontSize: 0.875rem
    lineHeight: 1.4
  code:
    fontFamily: "ui-monospace, SFMono-Regular, monospace"
    fontSize: 0.875em
rounded:
  sm: 0.25rem
  md: 0.5rem
  pill: 999px
spacing:
  xs: 0.25rem
  sm: 0.5rem
  md: 0.75rem
  lg: 1.5rem
motion:
  duration:
    fast: 120ms
    base: 200ms
    slow: 320ms
  easing:
    standard: "cubic-bezier(0.2, 0, 0, 1)"
    emphasized: "cubic-bezier(0.3, 0, 0, 1)"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-danger:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-error}"
    rounded: "{rounded.md}"
variants:
  dark:
    colors:
      primary: "#7BB0F0"
      primary-hover: "#92BFF5"
      neutral: "#A8A8A8"
      success: "#66C67A"
      warning: "#E8BA5A"
      error: "#EB7A7A"
      link: "#8FB4FF"
      link-hover: "#B0C8FF"
      on-primary: "#0B1116"
      on-error: "#0B1116"
---

## Overview

stream-ui's default look — minimal, theme-neutral, designed to inherit the host
app's color scheme where possible. Components expose `.sui-*` classes that read
CSS custom properties generated from this file. Override the variables in your
app's stylesheet to retheme without touching component code.

Agents consuming this file should pick colors by *intent* (semantic name), not
by hex. The palette is deliberately small so component variants map cleanly.

## Colors

- **primary** — primary action buttons, focus rings, link base color.
- **success / warning / error** — status communication in alerts and badges.
- **neutral** — borders, dividers, table stripes. The raw CSS currently applies
  neutral via low-alpha grey so it adapts to both light and dark backgrounds.

## Typography

Stream-UI inherits the host app's font stack (`fontFamily: inherit`) so brand
typography is preserved automatically. Heading sizes descend from 1.75rem (h1)
to 0.85rem (h6); the spec captures h1/h2/h3 as representative anchors.

## Layout

Spacing tokens (`xs → lg`) drive the `gap` utility on stack/row/grid
containers (`sui-gap-sm/md/lg`). Compose layout through these primitives rather
than custom CSS.

## Shapes

Three rounded levels: `sm` (inline tags, code blocks), `md` (cards, buttons,
inputs), and `pill` (badges, progress bars).

## Motion

Stream-UI renders the majority of its UI at agent-cadence — values change in
bursts, not continuously — so transitions should feel reactive, not decorative.

- **duration.fast (120ms)** — local hover/focus shifts; color/background tweens.
- **duration.base (200ms)** — progress bar fills, state changes on a single
  component (e.g. button press).
- **duration.slow (320ms)** — structural changes (layout reflow, dialog
  enter/exit). Avoid beyond this; the agent's own streaming already provides
  the perceived motion.

Use `easing.standard` for general acceleration; `emphasized` for first-time
reveals (enter animations). No bounce, no overshoot — streaming UI should feel
precise, not playful.

## Components

Component tokens map to stream-ui's built-in kinds. Variants (hover, pressed,
disabled) are expressed as sibling entries with a related key name —
`button-primary` and `button-primary-hover` rather than nested states.

Valid component properties in this theme: `backgroundColor`, `textColor`,
`rounded`.

## Do's and Don'ts

- **Do** reference semantic tokens (`{colors.error}`) in derived themes instead
  of duplicating hex values — override the token, every consumer updates.
- **Do** set `variant: 'primary' | 'danger'` on buttons and let component
  tokens decide the color. Never inline custom colors in streamed specs.
- **Don't** introduce raw hex values in component props. That bypasses theming
  and breaks dark-mode overrides downstream.
- **Don't** add UI chrome the user didn't ask for. Prefer the smallest spec
  that fulfills the intent.
