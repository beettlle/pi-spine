# STATUS: SP-480 — Worker conditional pi -ne

**Task:** SP-480-worker-conditional-no-extensions
**Started:** 2026-07-02
**Completed:** 2026-07-02

## Progress

### Step 0: Preflight cleanup

- [x] Dismissed batch `20260703T051629` (`spine batch dismiss --reason sp-480-preflight --force`)
- [x] Stashed WIP; `spine preflight` passed (git-clean + no active batch)
- [x] Restored stash after preflight

### Step 1: Conditional -ne

- [x] `shouldWorkerUsePiNoExtensions` in `pi-extension-conflict.mjs`
- [x] `buildWorkerPiArgs` conditional `-ne`
- [x] Hint + doctor copy updated

### Step 2: Testing

- [x] No-conflict and conflict argv tests
- [x] Contract testCommand green (88.50% line coverage)

### Step 3: Documentation

- [x] operator-runbook updated
- [x] CONTEXT.md updated (Next Task ID → SP-481)

## Notes

- Root cause: unconditional `-ne` from SP-450 hid Cursor extension models.
