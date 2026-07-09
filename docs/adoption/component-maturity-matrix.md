# Component maturity matrix

Evidence-based **L0–L4** grading for pi-spine subsystems. Closes [#129](https://github.com/beettlle/pi-spine/issues/129). Rubric adapted from Babysitter's `MATURITY-MATRIX.md` (upstream source named in the issue).

**Audit date:** 2026-07-09  
**Commit:** `1c73668e` (lane branch `task/spine-lane-3-20260709T183137`)  
**Auditor:** SP-561 worker (docs-only CI audit)

---

## Grading rubric

| Level | Criteria |
|-------|----------|
| **L0** | No automated tests |
| **L1** | Tests exist but are not CI-gated |
| **L2** | CI-built only (typecheck/lint; tests not required on PR) |
| **L3** | CI-tested — unit/integration suite gated on PR/push to `main` |
| **L4** | Cross-axis validated — agent × model × OS matrix with blocking evidence |

**L4 bar (strict):** Do not assign L4 without documented cross-axis runs (multiple worker backends or OS runners, multiple models, blocking workflow). Optional weekly jobs with `continue-on-error: true` do not qualify.

---

## Summary

| Component | Grade | Test files (dedicated) | CI gate | Cross-axis |
|-----------|-------|------------------------|---------|------------|
| [Batch engine](#batch-engine) | **L3** | 186 (`tests/batch/`) | Yes | Partial (optional real-pi) |
| [Journal](#journal) | **L3** | 9 | Yes | No |
| [Contract verify](#contract-verify) | **L3** | 20 | Yes | No |
| [Dashboard](#dashboard) | **L3** | 11 | Yes | No |
| [CLI](#cli) | **L3** | 22 + smoke | Yes | No |
| [Extensions](#extensions) | **L3** | 2 (+ slash coverage) | Yes | No |

**Suite totals (2026-07-09):** 312 test modules · **1,881** assertions in `npm test` · **1,880 pass / 1 fail** without `SPINE_IS_WORKER` (1 pre-existing `CONTEXT.md` phase-tracking drift on this lane branch). CI uses the same `npm run coverage:check` path (tests + 77% line floor).

No component currently meets **L4**.

---

## CI workflow audit

### Primary gate — `.github/workflows/ci.yml`

Runs on **pull_request** and **push** to `main` (`ubuntu-latest`, Node 22):

| Step | Lines | What it proves |
|------|-------|----------------|
| Typecheck | 39–40 | `tsc` on `src/` and batch TS |
| Lint | 42–43 | ESLint zero warnings |
| Tests + coverage | 45–46 | `npm run coverage:check` — full stub test suite + **77%** line minimum (`scripts/coverage-policy.mjs`) |
| CLI smoke | 48–72 | `spine version`, `help`, `init`, `doctor` with pi stub |

This is the **blocking** quality gate for merges and releases.

### Release gate — `.github/workflows/release.yml`

| Step | Lines | Role |
|------|-------|------|
| CI status check | 38–72 | Fails publish if CI failed on tagged commit |
| Duplicate validation | 91–128 | Runs typecheck/lint/coverage if no green CI run exists |

### Optional real-pi — `.github/workflows/real-pi.yml`

| Property | Evidence | L4 impact |
|----------|----------|-----------|
| Trigger | `workflow_dispatch` + weekly cron (Mon 06:00 UTC) | Not PR-blocking |
| `continue-on-error` | Line 15 | Failures do not block merges |
| OS matrix | `ubuntu-latest` only | Single axis |
| Skip path | Lines 41–45 — skips batch when `pi` absent | Incomplete coverage |

Real-pi exercises the **batch engine + worker path** on adoption fixture `AD-002` via `scripts/real-pi-adoption-e2e.sh`. Documented manual evidence: [`real-pi-e2e.md`](./real-pi-e2e.md), [`stub-free-dogfood-report.md`](../compatibility/stub-free-dogfood-report.md).

---

## Per-component evidence

### Batch engine

**Scope:** `src/batch/**` — lifecycle, lanes, merge, integrate, gate, reconcile, worker host, review spawn.

| Evidence | Detail |
|----------|--------|
| Test modules | **186** under `tests/batch/` (e.g. `engine-lane-execution.test.mjs`, `reconcile.test.mjs`, `integrate-fast-forward.test.mjs`, `stall-sat020-integration.test.mjs`) |
| CI | Gated via `coverage:check` in `ci.yml` L45–46 |
| Coverage policy | `src/batch/**/*.mjs` in `COVERAGE_INCLUDES` (`scripts/coverage-policy.mjs` L18–21) |
| Real-pi | Optional weekly/dispatch in `real-pi.yml` L37–45 — **not** L4 (non-blocking, single OS) |
| QA note | Worker sessions (`SPINE_IS_WORKER=1`) block nested `startBatch` in ~44 tests — environmental; see [operator runbook §9](./operator-runbook.md#contract-testcommand-false-positives-in-worker-environment-issue-132) |

**Grade: L3** — extensive CI-gated suite; real-pi adds manual/optional signal only.

---

### Journal

**Scope:** `src/batch/journal.mjs`, `journal-rebuild.mjs`, attach/export CLI.

| Evidence | Detail |
|----------|--------|
| Test modules | **9** dedicated: `journal.test.mjs`, `journal-rebuild.test.mjs`, `journal-rebuild-incidents.test.mjs`, `journal-cache.test.mjs`, `journal-attach.test.mjs`, `journal-export-jsonl.test.mjs`, `journal-export-markdown.test.mjs`, `journal-rebuild-drift.test.mjs`, `journal-cli.test.mjs`; plus `tests/cli/journal-follow.test.mjs` |
| CI | Same gate as batch engine |
| Isolation | SP-070 journal attach isolation in stub suite |

**Grade: L3** — dedicated tests, CI-gated; no cross-axis journal validation.

---

### Contract verify

**Scope:** Post-worker contract enforcement (`contract-verify` batch path), packet validation (`src/tasks/packet/validate-contract.mjs`).

| Evidence | Detail |
|----------|--------|
| Batch tests | **16** `tests/batch/contract*.test.mjs` (e.g. `contract-verify.test.mjs`, `contract-verify-nested-spawn.test.mjs`, `contract-verify-scoped.test.mjs`) |
| Packet/CLI tests | **4** — `tests/tasks/validate-prelanded-contract.test.mjs`, `validate-contract-warn.test.mjs`, `contract-parse.test.mjs`, `tests/cli/tasks-validate-contract.test.mjs` |
| CI | Gated; contract failures are terminal batch outcomes (tested in `contract-failed-terminal.test.mjs`) |
| Config | `tests/config/contract-mode.test.mjs` |

**Grade: L3** — well-covered contract path in CI; no multi-model/OS matrix for contract subprocess env (see [#155](https://github.com/beettlle/pi-spine/issues/155) for worker-env false positives).

---

### Dashboard

**Scope:** `src/dashboard/**` — server, SSE, snapshot, lane throughput, static UI.

| Evidence | Detail |
|----------|--------|
| Test modules | **11** under `tests/dashboard/` (`server.test.mjs`, `snapshot.test.mjs`, `parity.test.mjs`, `ui-contract.test.mjs`, `lane-throughput.test.mjs`, etc.) |
| CI | Included in `npm test` / `coverage:check` |
| UI contract | `ui-contract.test.mjs` pins panel/snapshot shape |

**Grade: L3** — CI-gated; no browser/OS matrix or visual regression CI.

---

### CLI

**Scope:** `bin/spine.mjs`, `src/cli/**`, router, doctor, batch/gate/integrate commands.

| Evidence | Detail |
|----------|--------|
| Test modules | **22** under `tests/cli/` plus root-level CLI tests (`spine-init.test.mjs`, `spine-preflight.test.mjs`, etc.) |
| CI smoke | `ci.yml` L48–72 — version, help, init, doctor on ephemeral fixture |
| Doctor | **15** tests under `tests/doctor/` (overlap with CLI surface) |

**Grade: L3** — CLI tests + dedicated smoke step on every PR.

---

### Extensions

**Scope:** `extensions/spine-orchestrator.ts`, `extensions/spine/slash-commands.ts` (pi package hooks).

| Evidence | Detail |
|----------|--------|
| Test modules | **2** under `tests/extensions/` (`spine-orchestrate-slash.test.mjs`, `slash-commands-handlers.test.mjs`); slash coverage also in `tests/slash-commands.test.mjs`, `tests/spine-settings-slash.test.mjs` |
| Coverage floor | **70%** per-file minimum for `extensions/spine/slash-commands.ts` (`scripts/coverage-policy.mjs` L13–15) |
| CI | Extensions in `COVERAGE_INCLUDES`; TypeScript compiled in typecheck |
| Real-pi | Slash commands not isolated in real-pi workflow |

**Grade: L3** — thinner dedicated suite than batch/CLI but CI-gated with explicit coverage floor. Not L4 (no cross-pi-version matrix in CI).

---

## Path to L4 (gaps)

| Gap | Affected components | Suggested investment |
|-----|---------------------|----------------------|
| No blocking cross-axis workflow | All | Add required check: stub + real-pi on `ubuntu`/`macos`, multiple `agents.*.model` inherit overrides |
| `real-pi.yml` non-blocking | Batch engine | Remove `continue-on-error` or add PR-label triggered required job |
| Single OS in CI | All | macOS runner for worktree/dashboard smoke |
| Extension pi-version matrix | Extensions | Test against `minPiVersion` and current pi in scheduled matrix |
| Worker-env test pollution | Batch, contract | SP-491 / sanitize contract subprocess env ([#155](https://github.com/beettlle/pi-spine/issues/155)) |

---

## Related docs

| Doc | Use |
|-----|-----|
| [operator-runbook.md](./operator-runbook.md) | Daily operations, recovery, contract false positives |
| [real-pi-e2e.md](./real-pi-e2e.md) | Manual real-pi adoption E2E |
| [bootstrap-checklist.md](./bootstrap-checklist.md) | Adoption tiers 0–3 |
| [real-project-readiness.md](./real-project-readiness.md) | Pilot success criteria |

---

*Maintained as part of v2.1.0 reliability drain (SP-561). Re-audit when CI workflows or test layout changes materially.*
