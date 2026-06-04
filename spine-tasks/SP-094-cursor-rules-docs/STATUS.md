# SP-094: Cursor rules docs — Status

**Current Step:** 4
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-04
**Review Level:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] SP-092 + SP-093 done (both ✅ Complete in dependency STATUS files)

### Step 1: Design + operator docs
**Status:** ✅ Complete

- [x] `docs/design/cursor-rules-discovery.md` — discovery, selection, glob match, CLI, init, doctor
- [x] `README.md` — worker auto-discovery + CLI pointer
- [x] `docs/adoption/bootstrap-checklist.md` — init manifest + related doc link
- [x] `docs/adoption/operator-runbook.md` — §1.1 Cursor rules operator procedures

### Step 2: PRD + skill + SP-073 amendment
**Status:** ✅ Complete

- [x] `docs/PRD.md` — FR-WORK-05 expanded, §7.5.1, consumer layout, CLI table
- [x] `skills/create-spine-tasks/SKILL.md` — tier 4 rules, File Scope guidance
- [x] `spine-tasks/SP-073-fr-work-05-standards-wiring/PROMPT.md` — SP-094 amendment

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] `npm run typecheck` — pass
- [x] `SPINE_WORKER_STUB=1 npm test` — 505 pass

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md

**Current Step:** Complete
**Status:** ✅ Complete

## Discoveries

| # | Finding | Impact |
|---|---------|--------|
| 1 | Design doc placed under `docs/design/` (new folder); cross-linked from README, bootstrap, runbook, PRD §7.5.1, and skill. | Single operator-facing reference; no source reading required for routine rules maintenance. |
| 2 | SP-073 Step 3 checkbox left historical; amendment documents SP-093 supersession without re-opening completed task steps. | Avoids contradictory PROMPT checkboxes for finished work. |
| 3 | `templates/agents/worker.md` auto-selected standards line deferred from SP-092 — out of SP-094 file scope; worker template already references FR-WORK-05 via standing orders. | No change needed in this task. |
