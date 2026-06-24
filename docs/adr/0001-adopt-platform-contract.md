# 1. Adopt the SAH platform contract

Date: 2026-06-24

## Status

Accepted

## Context

`sdk` must conform to the org DevOps strategy (`SAH_DEVOPS_STRATEGY.md`) without
per-repo drift: one build/test contract, centrally-managed gates, automated dependency
hygiene, AI-driven review convergence, and supply-chain controls appropriate to its
deploy surface (library, no deploy surface — published mirror).

This repo is the **unified Go SDK mirror**. The Go module at the repo root
(`core/`, `zyins/`, `rapidsign/`, `proxy/`, `account/`, `catalog/`, `contract/`, ...)
is authored-style Go (≈205 `.go` files), and the `packages/{csharp,php,python,ts}`
trees are the sibling-language SDK mirrors (no Go code). It is read-only and
auto-published from `isa-platform/packages/*`; manual edits are overwritten on the next
release. Prior to this change it had no CI workflow, no `mise` contract, no central
config, and no Renovate.

## Decision

- **`mise` is the sole entrypoint.** `mise.toml` defines every universal verb
  (`setup`/`fmt`/`fmt-check`/`lint`/`test`/`build`/`scan`/`coverage`/`doctor`/`ci`)
  wired to the real Go toolchain: `gofmt`, `go vet`, `go test ./...`, `go build ./...`,
  `govulncheck`. Go 1.26.1 is pinned via `mise` (`[tools]`); the `go` backend uses
  official prebuilt binaries, so it installs cleanly on the stock runner. CI runs
  `mise run ci` via `jdx/mise-action` (SHA-pinned).
- **Central config** consumed from `dev-config` (lefthook, trunk, Renovate preset)
  pinned to `v1`; managed files are not hand-edited.
- **Git hooks** owned by `lefthook.yml`. No `.pre-commit-config.yaml`.
- **Org rule enforcement** ships through `trunk` sourcing the house rule-pack from
  `dev-config@v1`. No `gate` binary.
- **Dependencies** via Renovate (preset extends `dev-config#v1`). No Dependabot.
- **Review convergence** via the `dev-config` review-coordinator plus the safe-class
  auto-approver.

## Consequences

- The declared contract and the enforced gate are the same thing — drift is impossible.
- Platform standards are enforced centrally and survive contributor turnover; upgrading
  `dev-config v1` propagates here via Renovate.
- Legacy repo-local automation was absent; nothing to remove.
- **Standalone test gap (NEEDS-HUMAN):** `conformance_scenarios_test.go` reads
  `../../tests/conformance/scenarios.json` — a monorepo-relative path that only resolves
  inside `isa-platform`. In the standalone mirror that path is outside the repo, so
  `TestConformanceScenarios_FileLoadsAndHasMinimumCases` fails (`go test ./...` is
  non-green). The mock-driven test self-skips when `isa-mock` is unreachable, but the
  file-load test does not. The honest contract is committed as-is rather than weakening
  the test to fake green; the durable fix belongs in `isa-platform` (vendor the
  conformance fixtures into the published mirror, or gate the fixture-dependent test
  behind an env guard at generation time).
- **Formatting drift (NEEDS-HUMAN):** 13 generated `.go` files are not `gofmt`-clean, so
  `fmt-check` is also red. As with the test gap, the fix belongs upstream (run `gofmt`
  in the generator) rather than hand-editing mirror sources that the next publish
  overwrites; the conformance diff is deliberately kept off the generated trees.
- Because this repo is a published mirror, the durable place to enforce the contract is
  `isa-platform`; conformance committed here is overwritten by the next publish.
