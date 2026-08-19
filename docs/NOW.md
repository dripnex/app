# Dripnex — Now / Next / Not

Living board. Seeded as note `dripnex-now` so MCP agents can search `NOW`.

#now #roadmap #debt

Updated: 2026-08-18. Version in tree: 0.15.2.

## Now (true today)

- Desktop is the product. Account required (AuthGate). Sync is optional E2E.
- Magic link + React Email. API on Cloudflare (`api.dripnex.app`).
- AI on notes (local providers). Ask-notes and `search_notes` share one hybrid retriever.
- Dripnex AI is hosted Claude (product key). Dev builds show “Not in this build”.
- Notes are chunked locally on save. Ollama fills vectors in the background (`nomic-embed-text`).
- Ask Notes packs scored passages (not whole notes) and shows source chips.
- Settings → AI shows local index status (embedded / waiting).
- Floating selection toolbar + AI edits. Note Templates notebook (`templates`).
- MCP is wired (this machine `.mcp.json`) and **read-only by default**.
- Mermaid, Vim, KaTeX. Living board is this note (`dripnex-now`).
- Sync passphrase: generated six words, Emergency Kit, 1Password save (SDK + CSV).
- Search operators: `tag:` `#` `status:` `notebook:` `is:pinned` `is:trash`.
- Brand: quiet, no SaaS blue, no “AI-powered” marketing.

## Next

Shipped:

- Soft-delete Trash + Restore + Delete forever.
- Query layer: SQL filters + `count`/`countScoped`.
- Scoped FTS and template picker.
- MCP writes off unless `DRIPNEX_MCP_WRITES=1`.
- Command palette Quick Open.
- Emergency Kit + 1Password integration (`Settings → Integrations`).
- Dev renderer waits for Vite (no `chrome-error` hop).

You (not code): 0. Apex DNS: delete parking A/AAAA so `dripnex.app` is Pages, not `/lander`.

1. Create the encryption passphrase (Set up in the footer) so sync Retry works.
2. 1Password: Settings → Developer → Integrate with 1Password SDKs, then Save to 1Password.

Later:

- Deploy the plugin registry migration (`0009_plugin_registry`) so publish writes to Turso.
- Custom forum — Discourse later, reprint What’s New. Do not build one.
- Mobile.
- Web clipper, collaboration, RAG in the Worker.

Shipped after 2026-08-17:

- Mermaid viewport (pan / zoom / Expand). Dayjs + mermaid stay in Vite `optimizeDeps`.
- Showcase notes in Inbox; Untitled drafts go to trash.
- GitHub watchers: `owner/repo`, issue URL, or search. Pull writes / refreshes Inbox notes (`#github`).

Shipped this week:

- Settings for embed provider/model.
- Ask Notes citations are numbered in context and clickable.
- Graph is a knowledge map (kinds, inferred edges, inspector).
- GitHub connect + import an issue into Inbox.
- Ask Notes can search/read GitHub issues when connected.
- Settings → Plugins opens `init.js` and `styles.css` (Inkdrop-style hackability).
- Settings → General → Development Mode: Inspect Element + Toggle DevTools.
- `dripnex.menu.add` lands items in the Plugins application menu.
- Built-in **Paste as Link** (selection + clipboard URL, Mod+Shift+K).
- First launch writes `init.js` (Insert Date, Mod+Shift+D) and `styles.css`.
- Command palette + Plugins menu: Open Init Script, Open User Stylesheet, Open Keymap, Reload Plugins.
- `keybindings.json` overrides command chords (save to apply).
- Slash commands, fence languages, GitHub alerts, `<mark>` highlight.
- Outline panel (`#` in the header, `Toggle Outline` in the palette).
- Paste a URL: wrap the selection, or pick Title / Link / `<url>`.
- `dripnex-plugin install owner/repo[@tag]` — community plugins are their own repos.
- Settings → Plugins → Connect: paste `owner/repo[@tag]`. No fake marketplace.
- Official palettes: Parchment, Wave, Night. Themes are token layers; community themes are repos.
- Note templates: Meeting, Decision, Daily, Weekly, Reading, Issue (notebook `templates`).
- What’s New is authored (`docs/releases/`). Promotion PRs: `chore(release): promote X.Y.Z`. See `docs/WHATS_NEW.md`.
- Workspace view: click a notebook to focus the sidebar on that tree. Escape or the breadcrumb home returns to All Notes.
- Collapsed notebooks list notes from their descendants; expanded ones stay direct-only.
- Default notebook (Settings → General) is used for ⌘N from All Notes.

CSS path (decided 2026-08-17):
Keep CSS modules + tokens. Do not add Tailwind to desktop.

## Not (not v1)

- Mobile as launch
- Public plugin marketplace (browse in Settings) until one external plugin exists
- Custom forum — Discourse later, reprint What’s New
- Web clipper
- Collaboration
- RAG in the Cloudflare Worker

## Debt that still bites

- You: apex DNS, passphrase, 1Password SDK, `DRIPNEX_AI_KEY`. Footer Retry is no-op until the CEK exists.
- Vectors need Ollama (`nomic-embed-text`). Without it, retrieve is keyword-only.
- `docs/FIX_PLAN.md` is a pointer. Do not treat it as an inventory.

## How to audit with agents

Point an MCP client at `packages/mcp-server`, then:

1. Search notes for `NOW`, `debt`, `roadmap`.
2. Read this note (`dripnex-now`) and `docs/FIX_PLAN.md`.
3. Spawn explore agents on `packages/mcp-server`, `docs/FIX_PLAN.md`, and desktop sync/encryption.
4. Do not trust `docs/ROADMAP.md` phases.

## Sync on this machine

If the footer says Sync error: you are signed in, but there is no
content-encryption key. Use **Set up** and create a passphrase.
The CEK is cached locally (Keychain, or 0600 file if Keychain is off in dev).
