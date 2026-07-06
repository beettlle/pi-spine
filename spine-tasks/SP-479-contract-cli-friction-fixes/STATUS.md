# SP-479: Contract CLI friction fixes — Status

**Current Step:** Complete
**Status:** ✅ Done
**Last Updated:** 2026-07-06
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read issue #105
- [x] Dependencies satisfied (SP-478 .DONE present)

---

### Step 1: CLI fixes
**Status:** ✅ Complete

- [x] Add gate_open (and related) to spine wait --until valid diagnoses
- [x] Fix retry --force suggested command when taskId required

---

### Step 2: Tests
**Status:** ✅ Complete

- [x] Assert wait accepts land-loop diagnoses
- [x] Assert diagnosis suggests valid retry command

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] FULL test suite passing
- [x] Coverage gate (if applicable)
- [x] All failures fixed

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Docs updated
- [x] Issue updated
- [x] .DONE created

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| src must not import bin/ — moved wait logic to src/cli/spine-wait.mjs | Fixed in lane salvage | src/cli/spine-wait.mjs |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-07-02 | Task staged (split from parent) | PROMPT.md and STATUS.md created |
| 2026-07-06 | Operator salvage after worker_orphaned | Architecture fix + contract verify passed |

---

## Blockers

*None*

---

## Notes

Salvaged after worker_orphaned on batch 20260706T000138. Wait helpers live in `src/cli/spine-wait.mjs`; `bin/spine-wait.mjs` re-exports only.
