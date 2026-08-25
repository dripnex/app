# Install path — official packs

[#547](https://github.com/dripnex/app/issues/547) / [#562](https://github.com/dripnex/app/issues/562). Desktop only. No marketplace.

Three strings are not interchangeable:

| Role                               | Vim example                                               |
| ---------------------------------- | --------------------------------------------------------- |
| Manifest id / `scan().id` / folder | `dripnex-vim-mode`                                        |
| GitHub repo (working install spec) | `dripnex/plugin-vim`                                      |
| Registry slug                      | `dripnex-vim-mode` (same as id when the Worker is seeded) |

**Decision:** Settings Install and `dripnex-plugin install` treat an official slug as `owner/repo`. `dripnex-vim-mode` and `dripnex/plugin-vim` both fetch the GitHub release tarball (`dripnex-vim-mode-1.2.0.tar.gz` on v1.2.0). Same for `mermaid` → `dripnex/plugin-mermaid` and `math` → `dripnex/plugin-math`. Unknown kebab names still hit `GET /plugins/:slug`.

Browse merges the first-party catalog into the live list so Vim cannot vanish when the API omits it. Updates match `scan().id` to registry slug **or** the same GitHub repository.

## Satellite publish path

Inkdrop-style: the registry is the index, the GitHub Release tarball is the artifact. No marketplace.

1. `dripnex-plugin pack` writes `{id}-{version}.tar.gz` (`manifest.id`, not the repo name).
2. Attach that archive to a GitHub Release (`gh release create vX.Y.Z {id}-{version}.tar.gz`).
3. Seed the index in this repo (GitHub-down fallback + slug/name overrides):
   - Live `GET /plugins`: `FIRST_PARTY_PACKAGES` in `packages/api/src/routes/plugins.ts`. Deploy with `packages/api` — production is `pnpm --filter @dripnex/api deploy:production` / `.github/workflows/deploy-api.yml` on `main`.
   - Browse fallback: `COMMUNITY_CATALOG` in `apps/desktop/src/renderer/pages/settings/sections/plugins/communityCatalog.ts`. `id` must equal `manifest.json` `id`; `repository` is `owner/repo`.

Do not list a pack until the Release has the packed tarball — Browse Install would 404. A git tag alone is not enough. Named palettes ship as satellite packs, not core. Settings → Themes shows the `tokens.css` default plus installed plugin themes.

Same three-string rule as Vim. Parchment: id `theme-parchment`, repo `dripnex/theme-parchment`, asset `theme-parchment-0.1.0.tar.gz` on `v0.1.0`.

**First-party Browse auto-list:** `GET /plugins` on the Worker (`packages/api`) discovers public `dripnex/theme-*` and `dripnex/plugin-*` repos whose latest GitHub Release has a packed `.tar.gz` asset (the `{id}-{version}.tar.gz` parchment pattern — never the git tag source tarball). A satellite that only publishes that Release appears in Browse without editing `FIRST_PARTY_PACKAGES`. That seed is the GitHub-down fallback and the slug/name override map (`dripnex-vim-mode` → `dripnex/plugin-vim`). Community marketplace / `services/plugin-registry` (#389 / #397 / #422) is still out.

**userData:** CLI and the packaged app share one folder. Electron would follow package.json `name` `@dripnex/desktop` (`~/.config/@dripnex/desktop`) unless main calls `app.setName('Dripnex')` and `app.setPath('userData', resolveUserDataRoot())` before `createDataPaths` (#572). Default: `~/.config/Dripnex`, `%APPDATA%/Dripnex`, `~/Library/Application Support/Dripnex`. Then `@dripnex/desktop`, then legacy `dripnex`. If more than one exists, prefer `dripnex.db`, then `plugins/` — no silent copy. Overrides: `DRIPNEX_DATA_DIR`, `--user-data-dir`.
