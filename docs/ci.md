# CI

Non-draft PRs into `develop`: CI green = squash auto-merge.

- Workflow: `.github/workflows/automerge.yml` runs `gh pr merge --auto --squash`.
- `--auto` waits for required status checks. Red CI does not merge.
- Drafts stay out. PRs targeting a feature branch stay out.
- No `automerge` label. No review required. CodeRabbit is not a required check.

Required on `develop`: `lint`, `test`, `typecheck`, `e2e`, `security` (from `.github/workflows/ci.yml`) and `commitlint` (from `.github/workflows/pr-title.yml`). Not deploy.

Decision: [`docs/adr/006-ci-green-automerge.md`](./adr/006-ci-green-automerge.md).
