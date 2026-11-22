# Upstream baseline

This repository is a downstream additive fork of **ZCode** with the complete upstream
Git history preserved. This file is the authoritative record of the import.

| Field | Value |
|---|---|
| Product | MOS workspace (YouTube Content Intelligence, official-plugin delivery) |
| Upstream | https://github.com/zai-org/zcode |
| Baseline commit | `fec975905a2abd4c07e35c40d51fa097a2258ec9` |
| Baseline tag | `v3.18.2` ("chore: sync ZCode source v3.18.2") |
| Import date | 2026-11-22 |
| Import method | full clone (all objects and tags); `main` pushed at the baseline commit with all upstream tags; `origin` = payswapdotorg/MOS-workspace, `upstream` = zai-org/zcode |
| Delivery mode | official ZCode plugin (`apps/zcode-cli/packages/mos-plugin`), additive — same pattern as `payswapdotorg/payswap-4.0` |

## Remotes

```bash
git remote -v
# origin   https://github.com/payswapdotorg/MOS-workspace.git  (push/pull product work)
# upstream https://github.com/zai-org/zcode.git                (fetch upstream updates)
```

## Upstream merge policy

1. Fetch `upstream` and inspect the delta (`git log main..upstream/main`).
2. Merge onto `main`; upstream history is never rewritten here.
3. Expected friction points (the complete modified-upstream-file list for this
   repository): `apps/zcode-cli/packages/bootstrap/src/app/official-plugin-definitions.ts`
   (one added block at the end of `OFFICIAL_PLUGIN_DEFINITIONS`),
   `apps/zcode-cli/packages/bootstrap/package.json` (one devDependency),
   `apps/zcode-cli/packages/bootstrap/tests/plugins.test.ts` (one added test),
   `architecture-policy.yaml` (one added module), root `pnpm-lock.yaml` (importer
   entries). Everything else — including the entire mos-plugin package, the
   launch-path tests, CI and docs — is new-file-only and cannot conflict.
