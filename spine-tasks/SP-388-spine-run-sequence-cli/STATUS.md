# SP-388: spine run sequence CLI — Status

**Current Step:** Step 1
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-30
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Resolve command naming: spine run sequence vs batch sequence (pick one, document)

**Decision:** Use `spine run sequence <scope>` (not `spine batch sequence`). Aligns with GitHub #54 primary example, existing `spine run pending` alias under `run`, and CONTEXT Phase 47. Documented in `bin/spine-run.mjs` and `src/cli/sequence.mjs`.

---

### Step 1: CLI wiring
**Status:** 🟡 In Progress

- [x] Add sequence subcommand and flag parsing
- [x] Integration test with stub sequence fixture

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] See PROMPT.md

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Command naming: `spine run sequence` over `batch sequence` | Accepted per #54 | `bin/spine-run.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-30 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-30 | Step 0 preflight | Chose `spine run sequence`; documented in run router |
| 2026-06-30 | Step 1 CLI wiring | Added sequence CLI, router, tests |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
