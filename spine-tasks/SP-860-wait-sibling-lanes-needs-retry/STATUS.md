# SP-860: wait sibling lanes needs_retry — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-11-16
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] GitNexus impact on `reconciliationMatchesUntil` / wait poll; report blast radius in STATUS
- [ ] `rg -n "reconciliationMatchesUntil|needs_retry" tests/cli/`

### Step 1: Wait match gate
**Status:** ⬜ Not Started

- [ ] Do not match `needs_retry` while any sibling task is still running
- [ ] Match once siblings are terminal

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Sibling-running vs sibling-terminal cases

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Contract `testCommand` passing
- [ ] All failures fixed

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-16 | Task staged | PROMPT.md created |

## Blockers

*None*
