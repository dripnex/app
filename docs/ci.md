# CI

Non-draft PRs into `develop`: CI green = squash auto-merge.

- Workflow: `.github/workflows/automerge.yml` runs `gh pr merge --auto --squash`.
- `--auto` waits for required status checks. Red CI does not merge.
- Drafts stay out. PRs targeting a feature branch stay out.
- No `automerge` label. No review required. CodeRabbit is not a required check.

Required on `develop`: `lint`, `test`, `typecheck`, `e2e`, `security` (from `.github/workflows/ci.yml`) and `commitlint` (from `.github/workflows/pr-title.yml`). Not deploy.

## Triggers

`.github/workflows/ci.yml` runs on:

- `pull_request` targeting `develop` or `main` — this is where required checks run
- `push` to `main` only — post-promotion record. **Release does not wait on CI** (`release.yml` is a separate `push` to `main` workflow).

It does **not** run on `push` to `develop`. Every change already ran as a PR; a squash-merge would otherwise pay the full suite a second time.

Release back-merges (`chore/backmerge-*`, or github-actions titled `chore(release): merge main into develop`) skip the heavy jobs. Required check names still report success so the PR can merge with a **merge commit**, never squash ([`docs/RELEASE.md`](./RELEASE.md)).

## CodeQL

One scan: `.github/workflows/codeql.yml` (advanced setup). The job is named `CodeQL` so the develop ruleset context stays green when a back-merge skips the scan.

Keep GitHub **default setup** off so PRs do not also get `Code Quality: PR #N` from `dynamic/github-code-scanning/codeql`.

Disable it (repo admin):

1. **Settings → Advanced Security** (or **Code security**) → CodeQL / Code scanning → Default setup → **Disable**.
2. If **Settings → Code quality** has its own Default setup toggle, disable that too.

API equivalent (needs security-admin; a typical Actions / integration token gets 403):

```bash
gh api -X PATCH /repos/dripnex/app/code-scanning/default-setup -f state=not-configured
gh api -X PATCH -H "X-GitHub-Api-Version: 2026-03-10" \
  /repos/dripnex/app/code-quality/setup -f state=not-configured
```

Decision: [`docs/adr/006-ci-green-automerge.md`](./adr/006-ci-green-automerge.md).
