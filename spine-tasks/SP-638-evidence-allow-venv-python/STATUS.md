# SP-638: Evidence allow venv python — Status

**Current Step:** Step 1 — Allow project-local python paths
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
**Status:** 🔄 In Progress
- [ ] Allow .venv/venv relative python
- [ ] Reject bare python / outside paths
- [ ] Unit tests

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
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
| `ALLOWED_EVIDENCE_EXECUTABLES` is basename-only (`path.basename(argv[0])`) | Add project-local interpreter path check before/alongside basename allow |
| Security: bare `python` uses PATH; absolute paths escape project | Allow only relative paths under `.venv/` or `venv/` with basename `python`/`python3`; reject `..`, absolute, bare names |

## Notes — Step 1 Plan

1. Add `ALLOWED_PROJECT_LOCAL_INTERPRETERS` = `{python, python3}`.
2. In `parseEvidenceCommandArgv`, after tokenize: if basename ∈ existing allowlist → accept (unchanged). Else if relative path under `.venv/` or `venv/` (posix-normalized, no `..`, not absolute) AND basename ∈ interpreters → accept. Else reject.
3. Document exact rule in code comments.
4. Tests: allow `.venv/bin/python …`, `venv/bin/python3 …`; reject bare `python`, `/usr/bin/python`, `../../.venv/bin/python`, `.venv/../evil/python`.

## Completion Criteria


- [ ] See PROMPT Completion Criteria

## Blockers

_None yet._
