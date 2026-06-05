# SP-108 — Brutal audit: adoption, docs & test quality

**Date:** 2026-06-05  
**Auditor:** spine worker (read-only)  
**Scope:** adoption path, CI, agent templates, integration fixtures, docs (not `tests/batch/**` deep re-audit — SP-106)

---

## Executive summary

pi-spine has a **large, mostly green test suite** (559 tests, 83.44% in-scope line coverage) and solid adoption scaffolding (fixture repo, runbook, bootstrap checklist, stub smoke). The adoption path is **operationally usable** but **documentation and CI guardrails lag the product**: stale inventories, contradictory stall defaults, empty testing fields in the dogfood config, and a coverage gate that **does not run the full test suite**.

**Cleanliness score: 6/10** (1 = pure architecture, 10 = vibe-coding mess) — strong orchestration tests and coverage policy; weakened by doc drift, stub-heavy integration, and enforcement gaps.

### Preflight (Section X)

| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test` | **559** pass, 0 fail (~127s) |
| `npm run coverage:check` | **83.44%** line (threshold 77%), **555** tests pass |

**Note:** Coverage gate runs **4 fewer tests** than `npm test` (missing `tests/agents/*.test.mjs`).

---

## Severity-rated findings

### F1 — HIGH: Coverage CI gate omits agent template-drift tests

**Category:** Section X (execution validation) + Section D (test quality)

📍 `scripts/coverage-policy.mjs` `TEST_GLOBS` vs `package.json` `scripts.test`  
📝 `TEST_GLOBS` ends at `tests/coverage/*.test.mjs`; **`tests/agents/*.test.mjs` is absent**  
❌ `npm test` → 559 tests; `npm run coverage:check` → **555 tests** (4 template-drift tests skipped)  
✅ Add `tests/agents/*.test.mjs` to `TEST_GLOBS`; extend `policy.test.mjs` to assert **bidirectional** glob parity  
⏱️ Effort: Small (30 min)

---

### F2 — HIGH: Dogfood repo has empty `testing.*` — integrate evidence and worker gates silently skip

**Category:** Section F (platform/adoption friction)

📍 `.spine/spine-config.json` lines 11–15  
📝 `"build": ""`, `"test": ""`, `"testWithCoverage": ""`  
❌ `spine init` populates these fields, but pi-spine's own config was never refreshed. Gate evidence, reviewer build gate, and worker coverage standing orders **no-op or fall back to PROMPT text**.  
✅ Refresh dogfood config; add doctor warning when `gates.collect*Evidence` is true but commands are empty  
⏱️ Effort: Small

Fresh init sets `build`/`test` via `applySpineInitDefaults()` in `bin/spine-init.mjs`; `testWithCoverage` comes from template clone. Template still ships empty `build`/`test` before init — confusing for pre-init readers.

---

### F3 — HIGH: Stub workers mask almost all batch/adoption integration behavior

**Category:** Section D4 (mock quality)

📍 `tests/batch/*.test.mjs`, `tests/adoption/fixture-batch.test.mjs`, `scripts/run-coverage.mjs` (defaults `SPINE_WORKER_STUB=1`)  
📝 20+ batch test files set `SPINE_WORKER_STUB=1`; **zero** automated tests run real `pi` workers  
❌ Stub path never exercises agent session spawn, review subprocess, MCP tool wiring under load, or real stall timing. `AD-002-real-pi-smoke` is **manual only** (`scripts/real-pi-adoption-e2e.sh`, not CI).  
✅ Optional scheduled/manual workflow for real-pi smoke; document stub limits in bootstrap checklist  
⏱️ Effort: Medium

---

### F4 — MEDIUM: Incident fixture inventory doc is stale (3/4 fixtures undocumented)

📍 `tests/fixtures/incidents/README.md` — lists only `orphan-running-resume.json`  
❌ Undocumented fixtures in active use:

| Fixture | Test file |
|---------|-----------|
| `resume-parallel-lane-orphan.json` | `tests/batch/orphan-reconcile.test.mjs` |
| `resume-orphan-historical-failure.json` | `tests/batch/orphan-detect-scope.test.mjs` |
| `lane-worktree-devcontainer.json` | `tests/batch/diagnosis-launch-failed.test.mjs` |

Runbook links orphan/resume narratives but not `docs/incidents/20260605-lane-worktree-devcontainer.md`.

---

### F5 — MEDIUM: Stall grace default documented three different ways

| Source | `stallGraceAfterProgressMinutes` |
|--------|----------------------------------|
| `src/batch/heartbeat.mjs` fallback | **15** |
| `docs/adoption/operator-runbook.md` / PRD | **15** (when unset) |
| `templates/spine-config.json` / dogfood config | **30** |

SP-087 raised template to 30 for real-pi; runbook/PRD fallback text was not fully reconciled.

---

### F6 — MEDIUM: Agent template drift guard covers worker only (SP-069 partial)

📍 `tests/agents/template-drift.test.mjs` — 4 tests, all `worker.md`  
❌ No drift tests for `reviewer.md` / `supervisor.md`. Reviewer template still documents a missing `empty testing.build` test case with no implementation.

---

### F7 — MEDIUM: Adoption docs mix `spine-tasks/` and `taskplane-tasks/` without a decision tree

Greenfield bootstrap says init creates `spine-tasks/`; fixture, migrate paths, and runbook `.DONE` examples use `taskplane-tasks/`. Interop is intentional but not surfaced as an explicit fork.

---

### F8 — MEDIUM: `spine-tasks/CONTEXT.md` says "150+ tests" — actual **559**

---

### F9 — LOW: PR template omits `npm run coverage:check` (SP-061 normative policy)

📍 `.github/pull_request_template.md` — only typecheck + npm test

---

### F10 — LOW: `spine-init.test.mjs` does not assert `testing.testWithCoverage`

SP-061 review flagged this; still open.

---

### F11 — LOW: Devcontainer incident — diagnosis fixture only, no worktree/git engine regression

📍 `lane-worktree-devcontainer.json` used in reconcile/headline tests only; SP-101–105 lack SAT-020-style integration fixture.

---

## Coverage holes table

| Module | Line % | Branch % | Risk |
|--------|--------|----------|------|
| `src/batch/resume.mjs` | 59.47 | 29.41 | Single-task resume |
| `src/batch/resume-multi.mjs` | 67.59 | 42.74 | Multi-task resume |
| `src/cli/rules.mjs` | 64.52 | 44.12 | `spine rules` CLI |
| `src/config/pi-spine-root.mjs` | 58.06 | 87.50 | Devcontainer env |
| `src/batch/lifecycle.mjs` | 71.39 | 39.13 | Dismiss/complete |
| `src/batch/retry.mjs` | 74.06 | 49.23 | Atomic retry |
| `src/batch/integrate.mjs` | 74.93 | 64.58 | Land loop |
| `src/batch/gate.mjs` | 79.11 | 60.00 | Integrate gate |
| `extensions/spine/worker-tools.ts` | 95.62 / **55.56 func** | Tool branches |

Aggregate: **83.44%** line, **69.26%** branch (branch not gated).

---

## Doc drift inventory

| Doc | Claim | Drift |
|-----|-------|-------|
| `spine-tasks/CONTEXT.md` | 150+ tests | 559 |
| `operator-runbook.md` | stall grace default 15 | template/dogfood 30 |
| `bootstrap-checklist.md` | init → `spine-tasks/` | fixture `.DONE` → `taskplane-tasks/` |
| `tests/fixtures/incidents/README.md` | 1 fixture | 4 on disk |
| `templates/spine-config.json` | empty build/test | init overwrites |
| SP-108 PROMPT scope | `tests/integration/**` | directory does not exist |

---

## CI gaps

| Gap | Severity |
|-----|----------|
| `coverage:check` skips `tests/agents/**` (555 vs 559) | HIGH |
| No real-pi / AD-002 automation | MEDIUM |
| PR template missing coverage checkbox | LOW |
| Doctor CI uses mock pi only | LOW |

---

## Recommended remediation tasks (SP-109+)

| ID | Title | Priority |
|----|-------|----------|
| SP-109 | Align TEST_GLOBS with full npm test + bidirectional drift test | P1 |
| SP-110 | Doctor warn on empty testing.* when evidence collection enabled | P1 |
| SP-111 | Expand agent template drift tests (reviewer, supervisor, init testWithCoverage) | P2 |
| SP-112 | Incident fixture README + runbook cross-links | P2 |
| SP-113 | Unify stall grace documentation (template 30 vs PRD fallback 15) | P2 |
| SP-114 | Adoption tasks-root decision table | P2 |
| SP-115 | Resume path coverage lift (resume.mjs, resume-multi.mjs ≥77%) | P2 |
| SP-116 | Optional real-pi adoption workflow (AD-002) | P3 |
| SP-117 | PR template + CONTEXT verification refresh | P3 |

---

## Ready for external adoption?

**YES with caveats** — stub smoke and runbook suffice for pilots accepting manual real-pi validation. Hands-off adoption blocked by F1 (CI suite split), F2 (empty testing config), F5/F7 (doc contradictions).

---

## Audit metadata

- Rules: `.cursor/rules/javascript-3-brutal-audit.mdc` Sections **F**, **X**
- Production code: not modified
