# Release manifest — v2.29.0

**Created:** 2026-10-22
**Current version:** 2.28.1 (published 2026-10-23 UTC, `3cd34c59`; direct S fixes from the v2.28 retrospective; global install is 2.28.1)
**Target version:** v2.29.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** pending — seeded from the v2.28 retrospective (delivery split: S fixes direct in v2.28.1, M changes as spine packets here)

---

## Release guardrails (v2.28 retrospective)

| Field | Value | Enforcement |
|-------|-------|-------------|
| **M-size budget** | ≤ 2 M packets per release | Composition audit fails above 2; extra M work moves to the deferred backlog |
| **Scope freeze** | End of Phase 3 (packets authored + `spine plan` clean) | After the freeze, new work is a patch release or the next manifest, not an amendment |
| **Binary policy** | Published global only (`spine` from npm) | Dogfood exception must be named here with reason and batch range. **Exceptions:** none |
| **Dependency chain depth** | ≤ 2 waves per batch | Deeper chains split into separate batches, each landed and `release:check`-green before the next starts |
| **Structural guards** | Every code `testCommand` includes `tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` | `spine-task-authoring.mdc` Definition of ready |
| **Host capacity** | `spine doctor` "stet review capacity" has no warning before each `batch start` | Second stet session, a concurrent batch, or swap under 2 GiB delays the start |

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 0 (runbook updates folded into SP-845) | 2–4 | WARN — no open documentation issues |
| Bug fixes | 1 issue / 1 task (#349 + `.DONE` deletion) | 3–5 | WARN — S bug fixes shipped direct in v2.28.1 |
| Enhancements | 1 task (separate stet review step) | 1–2 | PASS |
| **M packets** | 2 (SP-844, SP-845) | ≤ 2 | PASS |
| **Total tasks** | 2 | 10–15 | WARN — hardening release; operator may add S packets before the Phase 3 freeze |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Depends on |
|-------|-------|--------|------|-------|------------|
| SP-844 | #349 | bug | M | Lane commit keep-paths (`.review/`), merge duplicate sanitizers, stop same-lane `.DONE` deletion | — |
| SP-845 | — | enh | M | Separate contract review step: `reviewCommand`, `contract.reviewTimeoutMs`, `contract.reviewPolicy` (blocking / advisory) | — |

**Release scope ID:** `SP-844,SP-845`

**Wave plan:** one batch, one wave, chain depth 1. `spine plan SP-844,SP-845` serializes both on lane 1 because they share `src/config/settings-fields.mjs`, its test, and the runbook. That is the #349 same-lane case. The published v2.28.1 engine does not include SP-844's fix, so after SP-844 commits, check that `SP-844/.DONE` and `.review/` still exist before SP-845's contract runs.

**Outcome:** batch `20261023T030941-33c5` integrated as `a78f5098`. `SP-844/.DONE` and `.reviews/` survived SP-845 on lane 1. Both tasks passed lint, typecheck, tests, and the plan, code, and final reviews. Both contracts failed only on lenient stet findings that reviewed JSDoc hunks without the function bodies (1 for SP-844, 16 for SP-845, all verified against code and tests). The stet step was removed from both `testCommand`s (`ee33c83e`, lane `0762d637`), and both tasks were retried. Post-integrate `release:check`: 3193/3193 tests, 91.31% line coverage. Follow-up: use SP-845's `reviewCommand` with `contract.reviewPolicy advisory` for stet in future packets.

---

## Already in v2.28.1 (direct, not packets; published, #367/#368/#369 closed)

- #368 mutating subcommands honor `--help` (gate, integrate, settings set, issue, rules sync); strict flag parsing on gate/integrate
- #369 `contract.testTimeoutMs` setting wired to contract `testCommand`; timeout diagnosis suggests raising it
- #367 Kimi weekly `exceeded_current_quota_error` classified as quota exhaustion
- `stale_engine_pid` write rejections: journal carries `rejectedCount`; stderr only at 1 / 10 / 100…
- Base-sync overlap ignores paths both sides changed to identical content
- `spine doctor`: agent prompt template drift check; stet review capacity check
- Gate evidence: output streamed to a temp file, tail kept with an explicit truncation marker (no `ENOBUFS`)
- Load-sensitive tests: sequence wait loop takes an injected clock; stub worker hang uses a wall-clock deadline
- Removed tracked scratch `cur_exec.mjs` / `prev_exec.mjs`

---

## Risks and blockers

| Risk | Mitigation |
|------|------------|
| v2.28 contract runs shared LM Studio with a second stet session; hunks stalled ~15 min | Host-capacity guardrail above; SP-845 gives review its own timeout and an advisory mode |
| The load-induced stub `stall_timeout` test from v2.28 Batch E was not named in the log | The stub hang fix removes the known amplification. On recurrence, record the test name and file in this manifest before rerunning |

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #345, #337, #338, #331, #294 | bug | Not selected; candidates for S packets before the Phase 3 freeze |
| #348, #347, #344, #341, #339, #326 | enh | M-size budget used by SP-844 / SP-845 |
| Planner warning when chain depth > 2 | enh | Guardrail is manual this release |
