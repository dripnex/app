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

**userData:** packaged `productName` is `Dripnex`. CLI `resolveUserDataRoot` uses that folder first (`~/.config/Dripnex`, `%APPDATA%/Dripnex`, `~/Library/Application Support/Dripnex`), then `@dripnex/desktop`, then legacy `dripnex`. If more than one exists, prefer the one with `dripnex.db`, then `plugins/`. Override: `DRIPNEX_DATA_DIR`.
