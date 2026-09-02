# SP-739: salvage --integrate opens gate when none exists — Status

**Current Step:** Complete
**Status:** ✅ Done — re-verified after PROMPT sync from main (60e50d55, dropped minLineCoverage only); contract unchanged, `.DONE` recreated
**Last Updated:** 2026-09-02
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Reproduce no-gate salvage integrate failure in unit fixture — scratch fixture: `ok:false, GateBlocked, "Integrate gate not opened — approve evidence before merging"`, exit 2 (#274 reproduced)
- [x] Read `openIntegrateGate` / evidence collection APIs (gate.mjs, gate-evidence-collect.mjs, gate-revision.mjs, gate-posture-approve.mjs)

---

### Step 1: Open gate from salvage
**Status:** ✅ Complete

- [x] When salvageable and gate absent, open gate with salvage evidence + current orch tip pin — `openGateFromSalvageEvidence` writes `evidence/salvage-inspect.json`, calls `openIntegrateGate` (pins `targetRevision` via orch tip / HEAD fallback), journals `batch.salvage_gate_opened`
- [x] Fail closed if lane is not salvageable / evidence insufficient — non-salvageable lanes rejected before any gate open; guards for empty salvageableTasks / commitsAhead≤0; gate-open failures return GateBlocked exit 2
- [x] Keep existing path when gate already open — only `missing_gate` blocker triggers salvage open; pending/rejected/stale_revision paths unchanged (stale_revision reopen stays SP-740)

---

### Step 2: Tests + runbook note
**Status:** ✅ Complete

- [x] Test: no gate + salvageable lane → gate opened or integrate proceeds after open — 3 new tests: (1) opens fresh gate pending, evidence refs + tip pin asserted, approve → re-run lands lane work; (2) posture auto-approve opt-in proceeds end-to-end, `decidedBy: auto`; (3) non-salvageable lane opens no gate
- [x] Document recovery in operator-runbook salvage section (brief) — new "No gate record (#274)" rule bullet, updated gate bullet + typical workflow

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint — `npm run lint` clean (fixed 1 unused-var warning in new test)
- [x] Run Contract testCommand — `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/batch-salvage-integrate.test.mjs tests/batch/batch-salvage-list.test.mjs tests/batch/engine-gate-open.test.mjs`: lint clean, typecheck clean, 22/22 tests pass. Note: `engine-gate-open` requires `env -u SPINE_IS_WORKER` in worker sessions (SP-482 nested-batch guard blocks in-process `startBatch` under a worker env — environment, not regression; passes unmodified without worker env)

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Docs updates — `docs/adoption/operator-runbook.md` salvage section documents the no-gate recovery path (#274)
- [x] Create `.DONE`

---

## Discoveries

| Area | Finding |
|------|---------|
| Gate posture | Fresh salvage-opened gate stays **pending** under default locked posture — no approval bypass; auto-approve only via explicit `gates.postures.<category>` opt-in (`maybeAutoApproveIntegrateGate`) |
| Evidence pickup | `collectCoreEvidenceBundle` auto-includes any `salvage-*.json` in the evidence dir, so `salvage-inspect.json` lands in `gate.evidenceRefs` with no gate.mjs changes needed |
| targetRevision pin | `resolveGateTargetRevision` prefers orch tip, falls back to HEAD when orch branch absent (failed-before-merge case) — pin stable across approve → re-run |
| Worker env | `engine-gate-open.test.mjs` cannot run in-process under `SPINE_IS_WORKER=1` (SP-482 guard); contract testCommand needs `env -u SPINE_IS_WORKER` in worker sessions |
| Re-verify 2026-09-02 | Re-ran Step 3 verification after PROMPT sync: lint clean, typecheck clean, 21/22 under exact worker-env command (sole fail = SP-482 guard artifact), 22/22 with `env -u SPINE_IS_WORKER`. Engine plan (step 0) and code (step 4) reviews both APPROVE (`.reviews/`). |
