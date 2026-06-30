# SP-378: Attached merge finalize before engine exit — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-30
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Run SP-377 fixture (expect fail before fix)
- [ ] Read SP-316/SP-358 land loop paths

---

### Step 1: Finalize before exit
**Status:** ⬜ Not Started

- [ ] Ensure attached engine opens gate or spawns detached resume before SIGTERM exit path
- [ ] Make SP-377 fixture pass; keep SP-348 regression green

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Close issue #59
- [ ] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-30 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
