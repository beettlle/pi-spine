# SP-065: Reviewer template depth — Status

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

- [ ] Read SP-061 reviewer coverage text (if landed)
- [ ] Read spine-config testing command shape

---

### Step 1: Build + typecheck gate
**Status:** ⬜ Not Started

- [ ] Code review section: run `testing.build` and typecheck from `.spine/spine-config.json` (or documented fallback) **before** APPROVE on code reviews
- [ ] Fail closed: if build/typecheck fails, REVISE with command output summary

---

### Step 2: REVISE structure + review level rubric
**Status:** ⬜ Not Started

- [ ] **REVISE** must list blocking issues with file paths, line references, and missing test names/paths
- [ ] Add inline **Review Levels 0–3** rubric table (aligned with create-spine-tasks skill)
- [ ] Plan review section: evaluate step plan against PROMPT outcomes (unchanged spirit, clearer structure)

---

### Step 3: Fresh spawn + coverage
**Status:** ⬜ Not Started

- [ ] Document **fresh-spawn-only**: reviewer writes verdict to requested output path and exits — no waiting for worker, no `wait_for_review`
- [ ] Code review: verify **≥77% line coverage** on changed/in-scope modules (SP-061); REVISE when coverage or tests insufficient
- [ ] Preserve FR-REV-02 JSON verdict block contract

---

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Self-review: reviewer template is actionable without external Taskplane docs

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
| 2026-06-03 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
