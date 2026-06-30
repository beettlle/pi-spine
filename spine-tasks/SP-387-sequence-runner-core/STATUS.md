# SP-387: Sequence runner core loop — Status

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

- [ ] Read issue #54 sequence loop pseudocode
- [ ] Audit lifecycle/gate/integrate/complete CLIs

---

### Step 1: Sequence core
**Status:** ⬜ Not Started

- [ ] Implement per-wave: start → wait terminal → land loop steps
- [ ] Dry-run prints operator-equivalent commands
- [ ] Stub-worker fixture for 2-wave happy path

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] See PROMPT.md

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
