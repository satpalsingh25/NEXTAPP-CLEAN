---
name: Global dark mode via globals.css specificity
description: How we fixed dark mode across 30+ pages without touching individual files
---

## The Rule
Use `body.dark .classname { ... }` in globals.css to override Tailwind utilities in dark mode.
Specificity: `body.dark .class` = (0,0,1,1) > Tailwind utility `.class` = (0,0,1,0). No !important needed.

**Why:** The app has `.dark` on `document.body` (not `<html>`). This means any selector prefixed with `body.dark` beats single-class Tailwind utilities automatically.

**How to apply:** When a new page uses static Tailwind color classes (bg-white, text-slate-800, etc.), the globals.css overrides handle it automatically. Only custom patterns (toggle balls, inline styles) need individual fixes.

## CSS Variables
- `--bg`, `--text`, `--card`, `--muted`, `--border` — layout tokens
- `--input-bg`, `--input-text`, `--input-border`, `--input-placeholder` — form tokens
- `--card-hover` — hover background token
All defined in `:root` (light) and `.dark` (dark) in globals.css.

## Toggle Balls
Any toggle knob `<span>` using `bg-white` must use `.toggle-knob` class instead.
`.toggle-knob` = white in light mode, `#f1f5f9` in dark mode.
Applies to: smtp, dms-settings, storage-provider-modal, storage-settings-card, google-drive-fields, auth-settings.

## What globals.css covers
- bg-white, bg-slate-50/100/200, bg-gray-50/100/200
- text-slate/gray 400-950 (neutral only — colored variants like text-blue-600 NOT overridden)
- border-slate/gray 100-300
- hover:bg-slate-50/100/200 including /60 and /70 opacity variants
- divide-slate/gray 50/100/200
- Semantic status (bg-amber/red/green/blue-50/100, border-200, text darker)
- All form elements (input, select, textarea) via element selectors
- bg-slate-900/800 → readable rgba overlays for active state elements

## What globals.css CANNOT fix
- Inline `style={{ color: '...' }}` hardcoded hex values (fix individually)
- CSS gradient classes (from-slate-900, to-slate-950) — unaffected by overrides
- Tailwind opacity modifier on bg-slate-800 (bg-slate-800/60 ≠ bg-slate-800)
