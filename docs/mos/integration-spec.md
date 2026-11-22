# MOS workspace plugin — integration spec

Status: active · Product semantics: `payswapdotorg/MOS-4.0` (MOS 4.0 — YouTube Content
Intelligence) · Delivery mode: **official ZCode plugin**, additive fork of
`zai-org/zcode` (the `payswapdotorg/payswap-4.0` pattern).

## What this repository is

`payswapdotorg/MOS-workspace` is a full copy of `zai-org/zcode` (complete history +
tags) that adds the MOS research workspace as an **official plugin** — the same
additive pattern `payswapdotorg/payswap-4.0` uses to add PaySwap without removing or
modifying any host behavior:

| Change | File | Nature |
|---|---|---|
| Plugin package | `apps/zcode-cli/packages/mos-plugin/` | new, self-contained |
| Official definition (one block) | `apps/zcode-cli/packages/bootstrap/src/app/official-plugin-definitions.ts` | additive registration |
| Architecture module entry | `architecture-policy.yaml` | additive registration |
| Bootstrap launch-path acceptance | `apps/zcode-cli/packages/bootstrap/tests/mos-launch-path.test.ts` + `mos-plugin-build.ts` | new tests |
| Version-alignment guard | `apps/zcode-cli/packages/bootstrap/tests/plugins.test.ts` | one additive test |
| Bootstrap MCP SDK devDependency | `apps/zcode-cli/packages/bootstrap/package.json` + root `pnpm-lock.yaml` | additive dev-only |
| CI gate | `.github/workflows/ci.yml` | new |

No upstream file is deleted and no host behavior is modified; upstream merges only
touch the small registration surface above.

## What the plugin provides

Six model-visible `mos_*` tools (thin proxies; typed-refusal envelopes until the
host bridge is armed) mirroring MOS-4.0 Workflows A–I:

| Tool | Workflow | Semantics |
|---|---|---|
| `mos_expand_themes` | C | niche → 4-7 editable search themes |
| `mos_estimate_scan_cost` | D | quota cost estimate before a run |
| `mos_run_niche_scan` | D–G | discovery → enrichment → baselines → scoring (`mos-scoring-v1`) → classification |
| `mos_get_scan_results` | F–G | ranked results + per-factor explanations + honest status |
| `mos_list_saved_scans` | I | saved research with staleness badges |
| `mos_get_connection_state` | A | YouTube connection state (no token material) |

Three Class A informational `ui://` surfaces: `niche-explorer`, `scan-results`,
`evidence`. The OAuth connection card is Class B (host-rendered), never a plugin
surface.

## State model (typed refusals)

- **S0b** installed + disabled → no tools, no surfaces (`defaultEnabled: false`).
- **S1** enabled + not opted-in → tools registered; every call answers
  `{kind:"refused", refusal:{code:"not_opted_in"}}`; surfaces listed in the
  launcher (visibility only — panels are static skeletons).
- **S2** enabled + opted in, no connected authorization →
  `not_connected`.
- Wave 1 has no host bridge: the S1/S2 decision is a startup env snapshot
  (`MOS_RESEARCH_WORKSPACE`, injected from `userConfig.researchWorkspace`).

## Invariants (see `apps/zcode-cli/packages/mos-plugin/CONTRACT.md`)

- The MCP server process holds no credentials, no quota ledger, no scan data.
- Every manifest-injected env key lives in the `MOS_` namespace.
- Panels are static skeletons: zero external dependencies, zero placeholder data.
- Build always produces `.zcode-plugin/plugin.json` + `dist/server.mjs`
  (pinned by `requiredSeedPaths` and the version-alignment test).
- Runtime MCP server name: `plugin:mos:research` (workspace isolation).

## Verification

- `pnpm --filter @zcode/mos-plugin test` — tool registration, typed refusals,
  surface resources, contract/manifest namespace checks.
- `apps/zcode-cli` bootstrap `tests/mos-launch-path.test.ts` — full real chain:
  definition → build → seed → discovery (with `${user_config.*}` substitution) →
  stdio spawn → MCP calls (S1/S2 arms, disabled-plugin arm).
- `tests/plugins.test.ts` — version triangle (package = manifest = definition) and
  requiredSeedPaths existence for every official plugin.

## Roadmap to full MOS parity (Wave 2+)

1. Port the `@zcode/mos` engine (capability registry, quota ledger, YouTube API
   client, research engine) from `payswapdotorg/MOS-4.0` as a workspace package.
2. Add the host bridge in the plugin server (env-armed, typed `bridge_failure`
   face) calling the engine through the host service boundary.
3. Panel data pipelines (niche form → theme approval → progress → ranked results),
   replacing the static skeletons.
