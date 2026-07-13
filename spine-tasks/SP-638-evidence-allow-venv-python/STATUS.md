# SP-638: Evidence allow venv python — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-12
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm rejection
- [x] Review security boundaries

### Step 1: Allow project-local python paths
**Status:** ✅ Complete
- [x] Allow .venv/venv relative python
- [x] Reject bare python / outside paths
- [x] Unit tests

### Step 2: Testing & Verification
**Status:** 🔄 In Progress
- [ ] Contract
- [ ] Full suite
- [ ] Coverage ≥77%

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create .DONE

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| `.venv/bin/python -m unittest …` rejects with `evidence executable not allowed: python` (basename check only) | Extend allowlist with relative venv path rule; keep basename allow for npm/node/etc. |
| `ALLOWED_EVIDENCE_EXECUTABLES` is basename-only (`path.basename(argv[0])`) | Add `isAllowedProjectLocalInterpreter` for `.venv/`/`venv/` relative python/python3 |
| Security: bare `python` uses PATH; absolute paths escape project | Allow only relative paths under `.venv/` or `venv/` with basename `python`/`python3`; reject `..`, absolute, bare names |

## Completion Criteria


- [x] `.venv/bin/python …` parses for evidence
- [x] Bare `python` still rejected
- [ ] #199 closable

## Blockers

_None yet._
