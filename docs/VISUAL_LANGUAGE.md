# Desktop visual language

Rules for Dripnex desktop chrome. Tokens live in
`apps/desktop/src/renderer/ui/tokens/tokens.css`. This file is the
decision log so later polish does not invent a second system.

Brand voice and anti-values: [`docs/BRAND.md`](./BRAND.md).
AuthGate is required: [`docs/adr/002-authgate-stays.md`](./adr/002-authgate-stays.md).

---

## How to decide

1. Use a token. Do not hardcode color, type, space, or radius in a module.
2. Hierarchy is size, weight, and space. Color underlines. It does not
   steer (no accent timestamps, no accent title-on-focus).
3. If a change would “grab attention”, it is probably wrong.
4. If it is a brand call (accent hue, logo, mesh vs still wash), ask
   Tomás. Do not guess.

---

## Tokens

Canonical names are in `tokens.css`. Both dark and light define the same
set. Aliases exist for older modules (`--color-*`, `--bg-primary`).

Prefer:

| Role        | Token                                         |
| ----------- | --------------------------------------------- |
| Page        | `--bg-base`                                   |
| Pane        | `--bg-inset` (list), `--bg-elevated` (editor) |
| Row hover   | `--bg-hover`                                  |
| Raised card | `--glass-bg` + `--border`                     |
| Body text   | `--text-primary`                              |
| Secondary   | `--text-secondary`                            |
| Meta        | `--text-muted`                                |
| Icon empty  | `--text-faint`                                |
| Focus ring  | `--accent` + `--accent-muted` glow            |
| Danger      | `--danger`                                    |

Accent (`--accent`) is for focus, selection underline, links, and
active toggles. It is not a fill for every primary button.

**AuthGate primary action** is ink-on-paper: `--text-primary` on
`--bg-base` (inverted). Settings / in-app `Button` primary still uses
accent fill. Do not mix the two on the same screen.

---

## Type

```
--text-xs    11px   meta, chips, list footer
--text-sm    12px   hints, search, toolbar labels
--text-base  13px   chrome controls
--text-lg    14px   list titles, empty titles, editor title
--text-xl    16px   reserved
--text-2xl   18px   AuthGate heading
```

Weights: 400 body, 500 chrome titles, 600 AuthGate heading only.
Letter-spacing `--tracking-tight` on titles. Line-height
`--leading-normal` (1.5) in chrome, `--leading-relaxed` (1.65) on
AuthGate copy.

`body` is 14px. Do not invent a sixth size in a module.

Font: `--font-sans` (system UI). Editor body: user preference, default
`--font-mono`. If a font “speaks”, it is wrong.

---

## Space

4px scale: `--space-1` … `--space-10`.

| Surface        | Rule                                      |
| -------------- | ----------------------------------------- |
| Chrome headers | `--chrome-header-height` 44px, pad 8×10   |
| List rows      | 10×14, 2px between title / meta / preview |
| Empty states   | `--space-8` × `--space-6`, centered       |
| AuthGate card  | `--space-6` sides, `--space-8` bottom     |
| Forms          | `--space-2` between fields                |

Radii: `--radius-sm` 4, `--radius-md` 6, `--radius-lg` 8,
`--radius-xl` 12. AuthGate card is `--radius-xl`. Do not use 16px.

---

## Color (shipped vs brand vs site)

Shipped desktop (v0.16.0 tokens):

- Dark surfaces: `#0a0b0d` / `#111214` / `#18191c`
- Light surfaces: warm paper `#f3f2ee` / `#e7e5df` / `#fffcf7`
- Default accent: teal `#5eead4` dark, `#0d8a80` light

`docs/BRAND.md` specifies a muted gray accent (`#6b7280`) and off-white
`#fafaf9`. The 2026 marketing redesign draft used violet/indigo. Public
`dripnex.app` (22 Aug 2026) is a stub that redirects to `/lander`
(Cloudflare 525 when fetched). **Do not change the shipped teal or
logo in polish PRs.** Tomás owns that call.

Nested markdown list marks still use blue (`#60a5fa`) and violet
(`#c4b5fd`). That violates the brand “no SaaS blue / no AI purple”
rule. Tracked as a follow-up, not changed here.

---

## Empty-state voice

Empty states explain what is missing. They do not cheer, sparkle, or
sell.

**Shape:** faint 28px icon → 14/500 title → 12px muted hint.
Center in the pane (`flex: 1`), not a 200px stub.

**Copy:**

| State        | Title            | Hint                                      |
| ------------ | ---------------- | ----------------------------------------- |
| No notes     | No notes yet     | Press {mod}+N to create one               |
| Pinned empty | Nothing pinned   | Pin a note to keep it here                |
| Trash empty  | Trash is empty   | Deleted notes appear here                 |
| Search empty | No matches       | Try a different search                    |
| Editor empty | Select a note    | Or press {mod}+N to create one            |

Shortcuts use `modAccel()` (`⌘` on Apple, `Ctrl+` elsewhere).
No Sparkles. No “found”. No “your first”. Nested lists (notebooks,
tags) stay text-only.

---

## AuthGate

Keep the flow. Sign in / Sign up tabs, magic-link email, optional
Continue locally. See ADR 002 and #545.

Visual rules:

- Screen fills `--bg-base`. Card is glass + `--radius-xl`.
- Backdrop may move, but colors come from surface tokens (no blue
  wash). `prefers-reduced-motion` freezes the mesh.
- Follows `data-color-scheme` like the rest of the app.
- Tabs sit on `--bg-inset`; active tab is `--bg-elevated`.
- Input focus matches the Input primitive (accent border + muted ring).
- Primary button is inverted ink, not accent fill.

Whether the mesh stays at all is a Tomás call (brand says no
gradients). Polish may quiet it; do not remove the gate.

---

## Note list chrome

- Pane: `--bg-inset`. Header matches `--chrome-header-*`.
- Title in the header is `--text-lg` / 500, same weight as rows.
- Rows: hover `--bg-surface`. Selected: 8% `--text-primary` wash +
  2px inset accent bar (accent underlines).
- Timestamp is `--text-muted`, not accent.
- Preview: two lines, `--text-sm`, `--text-muted`.
- Staggered enter is allowed; honor `prefers-reduced-motion`.
- Search field: 28px, `--text-sm`, accent focus ring.

---

## Editor chrome

- Pane: `--bg-elevated`. Header same 44px chrome as the list.
- Title field: `--text-lg` / 500. Focus keeps `--text-primary`.
- Formatting toolbar: 28×28, `--radius-md`, hover `--bg-hover`.
  Active toggle: `--accent-subtle` fill + `--accent` icon.
- CodeMirror: transparent editor, tokenized gutters
  (`--cm-gutter-*`). Cursor and selection may use accent.
- Do not persist AST. Do not restyle the user’s markdown.

---

## Motion

150–200ms, `--transition-fast` / `--transition-normal`.
No bounce. No scale-on-press except existing 0.95 presses already in
chrome. Always respect `prefers-reduced-motion`.
