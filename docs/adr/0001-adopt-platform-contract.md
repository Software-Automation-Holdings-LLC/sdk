# 1. Adopt the SAH platform contract

Date: 2026-06-24

## Status

Accepted

## Context

`sdk` must conform to the org DevOps strategy (`SAH_DEVOPS_STRATEGY.md`) without
per-repo drift: one build/test contract, centrally-managed gates, automated dependency
hygiene, AI-driven review convergence, and supply-chain controls.

This repo is the **canonical unified Go SDK mirror** named by
[ADR-035](https://github.com/Software-Automation-Holdings-LLC/isa-platform/blob/main/docs/adr/035-sdk-mirror-distribution.md)
(SDK Mirror Distribution, which supersedes ADR-026). Per ADR-035 the Go mirror is
`Software-Automation-Holdings-LLC/sdk` with `<product>/` at the repo root; consumers
depend on `github.com/Software-Automation-Holdings-LLC/sdk/<product>`. The entire Go
module (`core/`, `zyins/`, `rapidsign/`, `proxy/`, `account/`, `catalog/`, `contract/`,
...) — Tier 1 generated wire types, Tier 2 vendored protocol primitives, and Tier 3
vendored ergonomic facades alike — is **auto-published from `isa-platform/packages/go`**
on every `sdk/<product>/v*` release tag. Manual edits are overwritten by the next
publish. Prior to this change it had no CI workflow, no `mise` contract, no central
config, and no Renovate.

The repo's disposition under SDK policy (`SAH_DEVOPS_STRATEGY.md` §12) is therefore
**Generated**, not Authored — the distinction that drives every decision below.

## Decision

- **`mise` is the sole entrypoint.** `mise.toml` defines the universal verbs
  (`setup`/`lint`/`test`/`scan`/`build`/`doctor`/`ci`) wired to the native Go toolchain.
  Go 1.26.1 is pinned via `mise` (`[tools]`); the `go` backend uses official prebuilt
  binaries, so it installs cleanly on the stock runner. CI runs `mise run ci` via
  `jdx/mise-action` (SHA-pinned).
- **The gate validates what a generated mirror owns.** A mirror is validated by the
  in-mirror smoke build ADR-035 step 5 prescribes — that the published tree builds,
  vets, and imports cleanly — not by re-running the source's tests. So `lint` is
  `go vet ./...` (build correctness), `build` is `go build ./...` (the consumer
  importability contract), and `test` is `go test -run '^$' ./...` (the whole tree,
  test sources included, compiles and typechecks; zero tests executed). The unit,
  conformance, and cross-SDK-parity suites of record run **upstream** in
  `isa-platform` (`sdk-conformance.yml`, `sdk-go.yml`) against the monorepo fixtures
  (`tests/conformance/*`, `shared/schemas/sdk/testdata/*`) that exist only there.
  `gofmt`/style linting of immutable published artifacts is likewise owned upstream
  where the source is editable.
- **Immutability per §12.** Generated trees already carry `// Code generated ...`
  banners. Hand-edits are pointless (overwritten next publish) and are prevented at the
  repo boundary by a generator-bot path-lock ruleset (see Consequences — requires an
  org-admin action). The regeneration-diff gate ("re-run the generator, fail on diff")
  runs in `isa-platform`'s `sdk-publish.yml`, where `buf` and the proto registry live.
- **Central config** consumed from `dev-config@v1` (lefthook, trunk, Renovate preset);
  managed files are thin pointers, not hand-edited copies.
- **Self-policing gate.** `.github/workflows/advisory-checks.yml` is a thin caller into
  `dev-config@v1` (flag-hygiene, observability-contract, workflow-conformance,
  pr-linear). `.github/workflows/security-scan.yml` routes gitleaks/semgrep/grype/
  govulncheck findings to Linear on the remediation-SLA model.
- **Git hooks** owned by `lefthook.yml`. **Dependencies** via Renovate (no Dependabot).

## Consequences

- The declared contract and the enforced gate are the same thing — drift is impossible,
  and `mise run ci` is green because it tests the mirror's real contract (importability)
  rather than the source repo's fixture-dependent suites.
- Platform standards are enforced centrally and survive contributor turnover; upgrading
  `dev-config v1` propagates here via Renovate.
- Legacy repo-local automation was absent; nothing to remove.
- **Upstream responsibilities (isa-platform, not this repo):** (1) the regeneration-diff
  gate and the full unit/conformance/parity test execution live in `sdk-publish.yml` /
  `sdk-conformance.yml` / `sdk-go.yml`; (2) Tier 2/3 vendored files
  (`contract/contract.go`, `core/license/hmac.go`, `rapidsign/types.go`,
  `rapidsign/internal/transport.go`, `zyins/credential_state.go`) ship without `// Code
  generated` banners and a few generated/vendored files are not `gofmt`-clean — running
  `gofmt` in the generator and stamping every published file with a generated banner are
  source-side hygiene items, tracked upstream. These are correctly out of scope here: a
  mirror cannot fix what the next publish overwrites.
- **Requires an org-admin action (not closeable by this PR):** the §12 generator-bot
  **path-lock** must be applied as an org ruleset on `sdk` restricting pushes to the
  published trees to the publish bot identity (the `sdk-publish` workflow's app). Until
  it lands, immutability rests on the `@generated` banners plus the next-publish
  overwrite; the ruleset makes hand-edits structurally impossible.
- Because this repo is a published mirror, the durable home for any change to the
  *content* is `isa-platform`; this PR governs only the platform-contract surface
  (`mise.toml`, pointers, workflows, ADR), which the publish step preserves.
