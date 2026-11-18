# SP-865: Runbook: contract artifactsMustExist / fileScopeMustNotChange fail-closed — Status

**Current Step:** Complete
**Status:** ✅ All Steps Complete
**Last Updated:** 2026-11-18
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Locate runbook contract / fileScopeMustNotChange sections; list sentences that contradict fail-closed #309

---

### Step 1: Contract fail-closed docs
**Status:** ✅ Complete

- [x] Document artifactsMustExist `..` rejection and `**` glob behavior
- [x] Document fileScopeMustNotChange fail-closed when git diff fails
- [x] Cross-link SP-867 / #309

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] `rg -l 'operator-runbook.md' tests/` and run only hits with `node --experimental-strip-types --test --test-reporter=dot <files>` (none → note "no tests reference this doc") — 2 hits: `tests/batch/adoption-doc-merge.test.mjs` (3/3 pass) + `tests/fixtures/scenarios/registry.json` (JSON fixture, not a runnable test)
- [x] Fix all failures — none; `npm run typecheck` pass and full stub suite 3260 pass / 0 fail (run with `SPINE_IS_WORKER`/`SPINE_WORKER_RUNNER` unset per worker-env requirement)

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-865-runbook-contract-fail-closed/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `docs/QUICK-REFERENCE.md` has no `artifactsMustExist` / `fileScopeMustNotChange` semantics coverage — only matrix/execution-only Contract examples cross-linking runbook §2.4/§2.5. Gap recorded per PROMPT ("Check If Affected … do not edit"); the new runbook section `#fail-closed-contract-checks-issue-309-sp-867` is the canonical link target if QUICK-REFERENCE is updated later. | Recorded, not edited | `docs/QUICK-REFERENCE.md` |
| `skills/create-spine-tasks/references/contract-template.md` § `fileScopeMustNotChange` semantics still says verify uses "cumulative `main...HEAD` diff until per-task scoping lands in SP-416" — SP-416 scoped verify has landed, so the "works today" phrasing is stale. Out of SP-865 File Scope (runbook-only); candidate follow-up doc task. | Recorded, not edited | `skills/create-spine-tasks/references/contract-template.md` |
| Full-suite verification inside a worker lane requires unsetting `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` (batch-engine tests otherwise fail with `nested_batch_spawn_blocked`, ~50 spurious failures). With them unset: typecheck + 3260/3260 tests pass. Already documented in SP-867 PROMPT Environment. | Recorded | `scripts/worker-verify.sh`, SP-867 PROMPT |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-18 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-18 | Step 0 preflight | Runbook §2.3 + issue-63 section have no artifactsMustExist/must-not-change failure-mode docs; no direct fail-open sentences, guidance gap only |
| 2026-11-18 | Step 1 docs | Added "Fail-closed contract checks (#309, SP-867)" subsection in §2.3; fail-closed git note in issue-63 section; Common batch failures row; commit b9bef124 |
| 2026-11-18 | Step 2 verify | typecheck pass; stub suite 3260/3260 pass; adoption-doc-merge tests 3/3 pass |
| 2026-11-18 | Step 3 delivery | Discoveries logged; .DONE created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
