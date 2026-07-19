# SP-673: Document parametric matrix and execution-only tasks in operator runbook — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-19
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Required files and paths exist
- [ ] SP-671 and SP-672 landed on `main`

---

### Step 1: Add matrix task documentation
**Status:** ⬜ Not Started

- [ ] Add `## Matrix` syntax section
- [ ] Provide example PROMPT snippet
- [ ] Explain `spine plan` sub-lane output
- [ ] Document failure behavior

---

### Step 2: Add execution-only task documentation
**Status:** ⬜ Not Started

- [ ] Add `Type: execute` frontmatter section
- [ ] Provide example PROMPT
- [ ] Explain use cases and caveats
- [ ] Document lane isolation and contract verify still apply

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` passes
- [ ] No application code changes
- [ ] Failures fixed

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] STATUS.md updated
- [ ] Links from README/index verified

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
| 2026-07-19 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
