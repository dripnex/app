# ADR 006: CI green on develop = squash auto-merge

**Status:** Accepted
**Date:** 2026-08-22
**Deciders:** Tomas Maritano

## Context

`.github/workflows/automerge.yml` only enabled auto-merge for Dependabot and for owner PRs that already had an `automerge` label. That extra label was a review hold, not a CI gate.

## Decision

- Non-draft PRs whose base is `develop` get `gh pr merge --auto --squash`.
- Drafts stay out. PRs targeting a feature branch stay out (no stacked-PR instant merge).
- Dependabot uses the same rule. No `automerge` label.
- `--auto` waits for required checks. Red CI does not merge.
- No review required. CodeRabbit is not a required check.

Required checks on `develop` are the real CI jobs from `.github/workflows/ci.yml` (`lint`, `test`, `typecheck`, `e2e`, plus `security`) and `commitlint` from `pr-title.yml`. Not CodeRabbit. Not deploy.

See [`docs/ci.md`](../ci.md).

## Consequences

Green CI on `develop` squash-merges. Hold a PR by keeping it draft or targeting a feature branch.
