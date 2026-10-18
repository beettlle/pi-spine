# SP-841: Stop telling workers to run per-step plan review — Status

**Current Step:** Not Started
**Status:** 🔵 Not Started
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] `rg -n 'plan review only|type=plan|--type plan' src templates tests` — record every hit in Discoveries

### Step 1: Prompt + template
**Status:** ⬜ Not Started

- [ ] Hint and template wording updated

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Old-string assertions replaced with new-wording assertions

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-841-worker-prompt-plan-review/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
