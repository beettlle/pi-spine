# SP-374: Preflight warn stale fileScopeMustChange — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-06-30
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read issue #56 suggested validate/preflight fix

---

### Step 1: Validate and preflight warnings
**Status:** ✅ Complete

- [x] Add warning (not hard fail) for stale fileScopeMustChange vs main
- [x] Suggest PROMPT amendment workflow in message

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [x] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Document warning in operator runbook § Contract
- [x] Close issue #56
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Heuristic: warn when fileScopeMustChange paths changed on main since task PROMPT first landed | Implemented | validate-prompt.mjs |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-30 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-30 | Step 0 | Read issue #56 — preflight/validate warn before batch |

---

## Blockers

*None*

---

## Notes

**Plan (Review Level 1):** Add `collectStaleFileScopeMustChangeWarnings` in `validate-prompt.mjs` — compare `git diff <first PROMPT commit>..main` for each `fileScopeMustChange` pattern. Wire into `spine tasks validate --warnings-only` and new preflight check `prelanded-file-scope`. Surface amendment guidance in warning text.
