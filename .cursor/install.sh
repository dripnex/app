#!/usr/bin/env bash
#
# Cloud Agent install script for Dripnex.
#
# Non-obvious constraints this script exists to satisfy:
#
#   1. node:sqlite FTS5 — @dripnex/mcp-server uses Node's built-in `node:sqlite`
#      (DatabaseSync) and asserts FTS5 is compiled in. The node binary the
#      Cursor exec daemon ships (/exec-daemon/node) has FTS5 DISABLED, so a
#      plain `node`/`pnpm test` would fail. We select an nvm-managed Node whose
#      bundled SQLite has FTS5 enabled and make it the default `node` for every
#      shell by symlinking the toolchain into a PATH dir that precedes
#      /exec-daemon.
#
#   2. better-sqlite3 (desktop) — apps/desktop's postinstall runs
#      `electron-builder install-app-deps`, which rebuilds better-sqlite3
#      against Electron's ABI. That is required for `pnpm dev` and the
#      Playwright+Electron e2e suite to launch. (This is why `pnpm test`
#      excludes @dripnex/storage-sqlite — see CLAUDE.md.)
#
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"
echo "==> Dripnex install (repo: $REPO_ROOT)"

# Dependabot-regenerated lockfiles can resolve GitHub git deps over SSH; CI
# rewrites them to HTTPS so the tarball install works without a deploy key.
git config --global 'url.https://github.com/.insteadOf' 'git@github.com:' || true

# --- 1. Select an FTS5-capable Node and make it the default ----------------
has_fts5() {
  "$1" -e 'const{DatabaseSync}=require("node:sqlite");const d=new DatabaseSync(":memory:");process.exit(d.prepare("SELECT sqlite_compileoption_used(\x27ENABLE_FTS5\x27) v").get().v===1?0:1)' >/dev/null 2>&1
}

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
NODE_BIN=""
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  # Prefer an already-installed Node >= 22 that has FTS5; otherwise install 22.
  for ver in $(nvm ls --no-colors 2>/dev/null | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | sort -Vr | uniq); do
    cand="$NVM_DIR/versions/node/$ver/bin/node"
    if [ -x "$cand" ] && has_fts5 "$cand"; then NODE_BIN="$cand"; break; fi
  done
  if [ -z "$NODE_BIN" ]; then
    echo "==> No FTS5-capable Node found; installing Node 22 via nvm"
    nvm install 22 >/dev/null
    cand="$(nvm which 22 2>/dev/null || true)"
    if [ -n "$cand" ] && has_fts5 "$cand"; then NODE_BIN="$cand"; fi
  fi
fi

if [ -z "$NODE_BIN" ]; then
  echo "ERROR: could not locate a Node build with node:sqlite FTS5 enabled." >&2
  exit 1
fi
NODE_BIN_DIR="$(dirname "$NODE_BIN")"
echo "==> Using Node $("$NODE_BIN" -v) (FTS5 enabled) from $NODE_BIN_DIR"

# Make the FTS5 node the default `node`/`npx` for every shell.
#
# The Cursor daemon's runtime PATH places /exec-daemon (which ships an
# FTS5-less node) AHEAD of the nvm bin, so a plain `node` would be wrong at
# agent runtime. Crucially, the install-time PATH can differ from the agent
# runtime PATH (install may run with nvm already ahead), so we cannot skip
# based on the current ordering — we ALWAYS place shims. We symlink the
# toolchain into every writable PATH dir that precedes /exec-daemon, plus
# /usr/local/cargo/bin (world-writable in the base image and consistently
# ahead of /exec-daemon at runtime). Symlinks live on disk, so they survive
# into environment builds/snapshots and win over /exec-daemon's node.
declare -a SHIM_CANDIDATES=()
IFS=':' read -r -a _path_entries <<< "$PATH"
for d in "${_path_entries[@]}"; do
  case "$d" in */exec-daemon*) break ;; esac
  SHIM_CANDIDATES+=("$d")
done
SHIM_CANDIDATES+=("/usr/local/cargo/bin")

_shimmed=""
for d in "${SHIM_CANDIDATES[@]}"; do
  [ "$d" = "$NODE_BIN_DIR" ] && continue          # never clobber the node bin itself
  case " $_shimmed " in *" $d "*) continue ;; esac # dedupe
  mkdir -p "$d" 2>/dev/null || sudo mkdir -p "$d" 2>/dev/null || true
  [ -d "$d" ] && [ -w "$d" ] || continue
  for b in node npm npx corepack pnpm pnpx yarn yarnpkg; do
    src="$NODE_BIN_DIR/$b"; dest="$d/$b"
    [ -e "$src" ] && [ "$src" != "$dest" ] && ln -sfn "$src" "$dest" 2>/dev/null || true
  done
  echo "==> Linked node toolchain into $d"
  _shimmed="$_shimmed $d"
done

# Ensure the rest of THIS script uses the FTS5 node too.
export PATH="$NODE_BIN_DIR:$PATH"
hash -r || true

# --- 2. Install workspace dependencies (runs postinstall scripts) ----------
# postinstall: lefthook install (git hooks) + electron-builder install-app-deps
# (rebuilds better-sqlite3 for Electron) + downloads the Electron binary.
echo "==> pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

# Belt-and-suspenders: ensure the Electron binary is materialized for e2e.
if [ -f apps/desktop/node_modules/electron/install.js ]; then
  echo "==> Materializing Electron binary"
  ( cd apps/desktop && node node_modules/electron/install.js )
fi

# --- 3. Build workspace packages (source-derived; needed by typecheck/e2e) -
echo "==> pnpm build"
pnpm build

# --- 4. Verify the critical invariant --------------------------------------
echo "==> Verifying node:sqlite FTS5"
node -e 'const{DatabaseSync}=require("node:sqlite");const v=new DatabaseSync(":memory:").prepare("SELECT sqlite_compileoption_used(\x27ENABLE_FTS5\x27) v").get().v;if(v!==1){console.error("FTS5 missing");process.exit(1)}console.log("node",process.version,"FTS5 OK")'

echo "==> Install complete."
