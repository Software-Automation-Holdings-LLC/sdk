# Improvement: reproducible C# dependencies for PR129

## Intent

Commit the real NuGet graph for Google.Protobuf 3.36.2 without changing the
published project's target frameworks or dependency versions.

## Evidence and ownership

- `Isa.Sdk.csproj` owns two target frameworks and three explicit package references.
- Before this change, no C# lockfile or C# repository task was present.
- The solution references an upstream test project absent from the mirror;
  runner tasks therefore address the published project, not that solution.
- NuGet owns graph generation and content hashes in `packages.lock.json`.
- `mise.toml` owns the pinned SDK and explicit locked restore/build commands.
- Ordinary restore/build behavior remains supported; locked verification is opt-in.

## Proof contract

- `mise run csharp-restore-locked`: rejects dependency graph drift.
- `mise run csharp-build`: compiles both target frameworks against the locked graph.
- Existing mirror regression: `mise run ci`.
- Required acceptance: full `hk run pre-push` over the requested commit range.

## Observed verification

- Locked restore passed through the repository runner.
- Release build passed for both targets with zero warnings and zero errors.
- A temporary .NET 8 consumer round-tripped the SDK's generated `HealthResponse`
  using Google.Protobuf assembly 3.36.2.0 on .NET runtime 8.0.33.
- Existing mirror CI passed. Its already-advisory Go scan reports vulnerabilities
  in the unchanged Go 1.26.4 toolchain; no scan policy was changed here.
- The required post-commit pre-push verdict is reported separately with the commit.
