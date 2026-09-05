# SP-747: Gate approve/reject optional synthesis note — Status

**Current Step:** 3
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-05
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Discoveries

| Area | Finding |
|-----|---------|
| Gate record schema | `.spine/runtime/<batchId>/gate.json`: `gateId, batchId, kind, category, status, openedAt, targetRevision, evidenceRefs, summary`; on decision `status, decidedAt, decidedBy` (+ `rejectionReason` on reject). `synthesis` is new + additive. |
| Approve/reject persistence | `src/batch/gate-posture-approve.mjs` — `approveIntegrateGate` / `rejectIntegrateGate` mutate the loaded record then `saveGateRecord`; journal events `gate.approved` / `gate.rejected`. |
| Status printer | `formatGateHuman` in `bin/spine-gate.mjs` prints Gate ID / Status / Kind / Evidence; `--json` dumps the whole result, so `synthesis` flows through automatically once on the record. Add human `Synthesis:` line when present. |
| Auto-approve path | `maybeAutoApproveIntegrateGate` → `approveIntegrateGate({decidedBy:"auto"})`. **Choice:** auto-approve leaves `synthesis` omitted (null) — `decidedBy:"auto"` already marks automation on the same record; a literal `"auto"` string could be mistaken for a human readback. |
| Schema consumers | All consumers (dashboard/snapshot, postmortem, sequence-wait, salvage, request-gate, attached-engine-handoff) read via `loadGateRecord` and inspect known fields only — additive field is transparent. |
| Impact analysis (GitNexus) | `approveIntegrateGate` upstream = **CRITICAL** (6 impacted: maybeAutoApproveIntegrateGate, runSequenceWaveLandLoop, salvage, runSequence). Mitigation: strictly additive optional `ctx.synthesis`, null-default preserved — no caller changes. `rejectIntegrateGate` = LOW (0 upstream). `formatGateHuman` not indexed (bin file). |

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Map approve/reject persistence fields and `spine gate status` printer
- [x] Confirm auto-approve path and gate.json schema consumers

---

### Step 1: CLI + persistence
**Status:** ✅ Complete

- [x] Parse optional `--synthesis` on approve and reject
- [x] Persist `synthesis` string on gate record; omit/null when flag absent
- [x] Auto-approve sets synthesis null or `"auto"` — **choice: omit (null)**; `decidedBy:"auto"` already marks automation, a literal `"auto"` could be mistaken for human readback
- [x] `spine gate status` displays synthesis when present

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint: `npm run lint` — clean
- [x] Run Contract `testCommand` — 41 pass / 0 fail (incl. 8 new SP-747 tests)
- [x] Fix all failures — none
- [x] Cover: approve with synthesis; approve without; reject with synthesis; status shows text (plus: whitespace-only treated as absent, auto-approve omits, status hides when absent, `npm run typecheck` clean, `detect_changes` risk low)

---

### Step 3: Documentation & Delivery
**Status:** ⚪ Not Started

- [ ] Update gate subsection in `docs/adoption/operator-runbook.md`
- [ ] Create `.DONE`
