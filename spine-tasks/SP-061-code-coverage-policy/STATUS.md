# SP-061: Code coverage 77% policy — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-03
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read current `npm test` and CI workflow
- [ ] Confirm no existing coverage tooling

---

### Step 1: Coverage tooling + npm scripts
**Status:** ⬜ Not Started

- [ ] Add `test:coverage` script
- [ ] Add threshold check failing below 77% line coverage
- [ ] Document threshold constant

---

### Step 2: CI + spine-config defaults
**Status:** ⬜ Not Started

- [ ] CI runs coverage check
- [ ] `templates/spine-config.json` `testing.testWithCoverage` populated

---

### Step 3: Agent + skill policy text
**Status:** ⬜ Not Started

- [ ] Worker template coverage standing order
- [ ] Reviewer template coverage verification
- [ ] create-spine-tasks skill + prompt template updated

---

### Step 4: PRD + verification
**Status:** ⬜ Not Started

- [ ] PRD coverage requirement documented
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` green
- [ ] Local coverage check passes at ≥77%

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-03 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*
