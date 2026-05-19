# Sah.Sdk C# migration guide (v0.2.x → v0.3.0)

The C# SDK has consolidated from four packages (`IsaSdk.Core`, `IsaSdk.ZyINS`,
`IsaSdk.RapidSign`, `IsaSdk.Proxy`) into **one** package: **`Sah.Sdk`**. See
`docs/SDK_DESIGN.md` §0 for the rationale.

## 1. Package reference

```diff
-<PackageReference Include="IsaSdk.Core"      Version="0.2.*" />
-<PackageReference Include="IsaSdk.ZyINS"     Version="0.2.*" />
-<PackageReference Include="IsaSdk.RapidSign" Version="0.2.*" />
-<PackageReference Include="IsaSdk.Proxy"     Version="0.2.*" />
+<PackageReference Include="Sah.Sdk"          Version="0.3.*" />
```

## 2. Namespaces

| Before             | After               |
| ------------------ | ------------------- |
| `IsaSdk.Core`      | `Sah.Sdk.Core`      |
| `IsaSdk.ZyINS`     | `Sah.Sdk.Zyins`     |
| `IsaSdk.RapidSign` | `Sah.Sdk.RapidSign` |
| `IsaSdk.Proxy`     | `Sah.Sdk.Proxy`     |

Project-wide string-replace works for the four-namespace map above. A Roslyn
codemod (`tools/codemod/Sah.Sdk.Codemod.csproj`) ships in v0.3.x to handle the
rename plus the `Isa` factory-shape change below.

## 3. Public surface

The top-level entry point is now a class (was four static classes):

```diff
-using IsaSdk.ZyINS;
-var client = Isa.WithBearer();
-await client.Prequalify.RunAsync(req);
+using Sah.Sdk;
+var isa = Isa.WithBearer();                       // reads ISA_TOKEN
+await isa.Zyins.Prequalify.RunAsync(req);
```

`Isa.WithLicense` is now `Task<Isa> Isa.WithLicenseAsync(LicenseOptions?)` to
mirror the cross-language async license-exchange contract. `Isa.WithSession`
remains synchronous.

## 4. Behavior preserved across the rename

- `IsaConfigException` still throws when env vars are unset.
- `IsaIdempotencyConflictException` shape (`Key`, `FirstSeenAt`) unchanged.
- `Envelope<T>` (with `RequestId`, `IdempotencyKey`, `RetryAttempts`) unchanged.
- `WithRawResponseAsync` variants unchanged.
- Stderr debug logging via `ISA_LOG=debug` unchanged.
- `netstandard2.0;net8.0` dual target preserved (PR #156/#158 fixes carried
  forward).
- `Google.Api.CommonProtos` dep preserved (PR #158).
- `IsExternalInit` polyfill carried forward at `src/Core/IsExternalInit.cs`.
- `System.Text.Json` conditional `PackageReference` preserved for
  netstandard2.0.

## 5. Codemod (preview)

```
dotnet tool install --global Sah.Sdk.Codemod --version 0.3.*
sah-sdk-codemod migrate --project MyApp.csproj
```

The codemod rewrites:

1. `using IsaSdk.<X>;` -> `using Sah.Sdk.<X>;` (with case mapping for `ZyINS` ->
   `Zyins`).
2. `Isa.WithLicense(...)` -> `await Isa.WithLicenseAsync(...)` (adds `async`
   modifier upstream).
3. `Isa.WithBearer(...)` return-type usage from `ZyInsClient` -> `Isa.Zyins.*`.

Manual review is required where call sites store the return value in a named
`ZyInsClient` local; the codemod inserts a `// TODO(sah-sdk):` marker.
