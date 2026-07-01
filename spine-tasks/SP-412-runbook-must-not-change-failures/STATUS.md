# SP-412: Runbook must-not-change failures — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-01
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read GitHub issue #63
- [ ] Dependencies satisfied

---

### Step 1: Preflight
**Status:** ⬜ Not Started

- [ ] Read issue #63 journal payload examples

---

### Step 2: Runbook common failures section
**Status:** ⬜ Not Started

- [ ] Symptom: testCommand pass, fileScopeMustNotChange fail on spine-tasks paths
- [ ] Fix: remove spine-tasks/** from must-not-change
- [ ] Note serialized lane cumulative diff until scoped verify (SP-416)

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

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
| 2026-07-01 | Task staged | PROMPT.md and STATUS.md created for GitHub #63 |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
