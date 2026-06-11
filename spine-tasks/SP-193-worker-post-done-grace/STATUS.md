# SP-193: Post-.DONE worker grace watchdog — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🟢 Complete
**Last Updated:** 2026-06-11
**Review Level:** 2
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Reproduce wedge logic in `worker-host.mjs`: `.DONE` break disables stall loop before `await childDone`
- [x] Read incident journal + `worker-output-SP-190.log`

### Step 1: Implement post-done grace
**Status:** ✅ Complete
- [x] Add `postDoneGraceMs` to stall config (default 3–5 min)
- [x] Replace bare `.DONE` break with grace window: heartbeats/stall optional during grace
- [x] Terminate child after grace; succeed when `.DONE` persists

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] Stub test: child hangs after writing `.DONE` → host terminates and returns `ok: true`
- [x] Regression: pre-.DONE stall timeout still works
- [x] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [x] Run: `npm run coverage:check` — ≥77% (83.60%)

### Step 3: Documentation & Delivery
**Status:** ✅ Complete
- [x] Note fix in `spine-tasks/_explore/reliability-epic/findings.md`
- [x] Create `.DONE` when complete

---

## Blockers

*None*

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-11 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-11 | Step 0–3 complete | Post-done grace, tests green, coverage 83.60% |
