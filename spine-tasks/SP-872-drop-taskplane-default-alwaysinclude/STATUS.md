# SP-872: Drop Taskplane rules from default worker alwaysInclude / init profile — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-11-18
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Confirm current alwaysInclude defaults and which tests pin Taskplane
- [ ] GitNexus impact on `DEFAULT_RULES_PROFILE`; report in STATUS

---

### Step 1: Drop Taskplane from defaults
**Status:** ⬜ Not Started

- [ ] Empty worker alwaysInclude in DEFAULT_RULES_PROFILE + templates/rules-profile.json
- [ ] Adjust DEFAULT_SPINE_INIT_STANDARDS per Mission item 3

---

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Update assertions; prove default alwaysInclude is empty

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-872-drop-taskplane-default-alwaysinclude/.DONE`

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
| 2026-11-18 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
