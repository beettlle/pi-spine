# SP-396: spine issue draft CLI — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-30
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read SP-395 exports
- [ ] Read `bin/spine.mjs` handoff/watch subcommand pattern

---

### Step 1: CLI implementation
**Status:** ⬜ Not Started

- [ ] Add `bin/spine-issue.mjs` with flag parsing and draft output
- [ ] Wire `case "issue"` in `bin/spine.mjs` help + dispatch
- [ ] `--create` spawns `gh issue create` with label from draft; no `--create` by default

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] CLI integration test: draft writes file, `--json` shape, `--create` guard
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Add one-line help in `bin/spine.mjs` usage block

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
| 2026-06-30 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
