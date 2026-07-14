# Security Policy

## Reporting a Vulnerability

This repository is a **read-only mirror** (see [README.md](README.md) and
[CONTRIBUTING.md](CONTRIBUTING.md)). If you find a security vulnerability in
the generated SDK code, please report it privately rather than opening a
public issue.

Email **zbornheimer@reachsah.com** with a description of the issue, the
affected package/version, and reproduction steps if available.

We do not currently offer a bug bounty program.

## Disclosure Policy

We follow coordinated disclosure: please give us 90 days to investigate and
release a fix before any public disclosure. We will acknowledge your report
and keep you updated as we work toward a resolution.

Because this repo mirrors generated code, a fix is typically applied at the
source of truth
([isa-platform](https://github.com/Software-Automation-Holdings-LLC/isa-platform))
and published here on the next mirror sync.

## Supported Versions

Only the latest published tag per module receives security fixes. Older tags
are not patched — upgrade to the latest tag for your module.

| Module    | Latest tag   | Supported |
| --------- | ------------ | --------- |
| sdk (root)| `v1.0.9`     | ✅        |
| core      | `core/v0.2.2`| ✅        |
| zyins     | `zyins/v0.2.2`| ✅       |
| all other tags | —      | ❌        |
