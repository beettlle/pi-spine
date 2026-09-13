# SP-753: wait human match/timeout headlines — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-09-13
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Confirm human-mode match path returns without `writeStdout` today
- [ ] Confirm supersede already has a human headline on stderr
- [ ] Dependencies satisfied

---

### Step 1: Human terminal headlines
**Status:** ⬜ Not Started

- [ ] On match (non-json): write one stdout line including diagnosis, scoped batchId, and elapsed when available
- [ ] On timeout (non-json): write one stdout or stderr line distinguishing timeout from match
- [ ] On interrupt (SIGINT path): write one human line when not json (if reachable in tests)
- [ ] Preserve `--json` single-snapshot stdout on match/timeout
- [ ] Unit tests: stub reconcile that matches / times out; assert `writeStdout`/`writeStderr` called in human mode

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
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
| 2026-09-13 | Task staged | PROMPT.md and STATUS.md created for v2.21.0 |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
