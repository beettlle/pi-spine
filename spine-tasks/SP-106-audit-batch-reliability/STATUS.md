# SP-106 — Status

**Task:** Brutal audit — batch engine & reliability  
**Updated:** 2026-06-05  
**Outcome:** Complete — `AUDIT-REPORT.md` published

---

## Step 0: Preflight

- [x] Read CONTEXT Phases 11–19 and incident docs
- [x] Run baseline: `npm run typecheck` — **PASS**
- [x] Run baseline: `SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test -- tests/batch/` — **559 pass / 1 fail** (spurious: npm treats `tests/batch/` as test module; see Discoveries)
- [x] Run corrected batch suite: `node --test tests/batch/*.test.mjs` — **258 pass / 0 fail**
- [x] Inventory module sizes under `src/batch/` — largest: `resume-multi.mjs` (898), `detached-start.mjs` (694)

---

## Step 1: Deep reliability audit

- [x] **Orphan/resume:** grep + read `orphan-detect.mjs`, `resume-multi.mjs`, `reconcile.mjs`, incident fixtures SP-082–098
- [x] **Stall recovery:** FR-STALL-01–03 via `worker-output.mjs`, `heartbeat.mjs`, `salvage.mjs`; tests in `stall-*.test.mjs`, `salvage-*.test.mjs`
- [x] **Launch failures:** SP-101–105 code on `main` (worktree, hook, `PI_SPINE_ROOT`, lane commit, diagnosis); CONTEXT still says Staged
- [x] **Journal/state integrity:** scoped orphan journal window (SP-095); `failBatchFromEngineError` (SP-097); parse errors fail loud in reconcile
- [x] **Error handling:** no empty catches in batch except git inspect + agent abort; generic `needs_retry` for lane orphan
- [x] **Test gaps:** PID-less ghost running; detached-start timeout → reconcile; fixture README incomplete

---

## Step 2: AUDIT-REPORT.md

- [x] Executive summary + cleanliness score **6/10**
- [x] 12 findings (≥5 required)
- [x] Top 10 modules table
- [x] Recommended SP-109+ remediation tasks
- [x] Ready for next wave: **YES**

---

## Step 3: Delivery

- [x] `AUDIT-REPORT.md` created
- [x] `STATUS.md` completed (this file)
- [x] No changes to `src/` or `tests/`
- [x] `.DONE` marker created

---

## Discoveries

| ID | Area | Severity | Evidence | Recommendation |
|----|------|----------|----------|----------------|
| D-01 | Orphan detect | HIGH | `orphan-detect.mjs:115-145` — no signal without workerPid/enginePid | SP-110 |
| D-02 | Diagnosis taxonomy | MEDIUM | Lane orphan → `needs_retry` (`reconcile.mjs:376-377`) | SP-113 |
| D-03 | God file | HIGH | `resume-multi.mjs` 898 lines | SP-109 |
| D-04 | Circular import | MEDIUM | `state.mjs:8` imports `reconcile.mjs` | SP-112 |
| D-05 | Detached start | MEDIUM | `enginePid` persist after wait only (`detached-start.mjs:581`) | SP-111 |
| D-06 | Git reconcile | MEDIUM | Empty catch `reconcile.mjs:278-301` | SP-116 |
| D-07 | Docs drift | LOW/MEDIUM | CONTEXT Phase 19 Staged; code landed | SP-114 |
| D-08 | Fixture README | LOW | Only 1/4 fixtures documented | SP-114 |
| D-09 | Test command | LOW | `npm test -- tests/batch/` spurious failure | SP-115 |
| D-10 | Agent worker | LOW | `agent-session-worker.mjs:277` silent abort | SP-118 or inline fix |
| D-11 | Test gap | MEDIUM | No detached timeout orphan E2E | SP-111/SP-112 |
| D-12 | Baseline | INFO | Typecheck clean; 258 batch tests green via direct node invocation | — |

---

## Baseline test record

```
npm run typecheck                          → exit 0
npm test -- tests/batch/                   → 559 pass, 1 fail (MODULE_NOT_FOUND tests/batch)
node --test tests/batch/*.test.mjs         → 258 pass, 0 fail (~97s)
```
