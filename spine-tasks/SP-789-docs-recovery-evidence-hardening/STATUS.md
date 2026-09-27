# SP-789: Runbook: v2.25.0 recovery-evidence hardening — Status

**Current Step:** Step 2 (Testing & Verification)
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-27
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Done

- [x] Dependencies `.DONE` on main
- [x] Capture exact names/messages from code
- [x] Dependencies satisfied

### Step 1: Runbook sections
**Status:** ✅ Done

- [x] §6 recovery-evidence section
- [x] §4 BaseMoved / DirtyOverlap
- [x] §2.4 matrix note
- [x] Names match code

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Contract `testCommand`
- [ ] Adoption tests
- [ ] Fix all failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| Area | Finding |
|------|---------|
| SP-788 | **Not landed on `main`** (folder exists, no `.DONE`; no `engine.crashed` / `engine-crash-guard.mjs` in src) → engine-crash subsection omitted per PROMPT |
| SP-780 | `signals.journalCorruptLines = { count, lines: [{lineNumber, byteOffset}] }` (first 20); skip reasons `json_parse_error` / `checksum_mismatch`; appends run `appendNewlineIfTornTail` so new events start on a fresh line; nothing rewritten |
| SP-786 | Quarantine name `batch-state.corrupt-<UTC-stamp>.json` (collision-safe `-N`); `assertNoActiveBatch` runs unconditionally so start refuses even with `--skip-preflight`; `.pi/batch-state.json` reported, never modified |
| SP-784 | `BaseMoved` failureClass via CAS `git update-ref` / first-parent check, message ends `— re-run spine integrate`; `DirtyOverlap: <paths> kept local edits — run git diff / git restore --source <base> -- <paths> after review`, journal `integrate.dirty_overlap`; sync returns null when base not checked out |
| SP-783 | Refusal before spawn: `matrix row command refused before spawn: …` (allows `&&`); `DEFAULT_MATRIX_ROW_TIMEOUT_MS = 600_000`, `SPINE_MATRIX_ROW_TIMEOUT_MS` override, exit 124 + `timedOut: true`; output tail capped `DEFAULT_MATRIX_ROW_OUTPUT_MAX_BYTES = 262_144` with `[… N bytes truncated …]` marker |

## Blockers

_None._
