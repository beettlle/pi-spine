# SP-888: Hydrate SP-* packet from GitHub issue — Status

**Current Step:** Complete
**Status:** ✅ Done (pending engine plan review)
**Last Updated:** 2026-11-22
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Inspect spine tasks subcommand patterns
- [x] Confirm thin-packet Mission/Context from SP-883

---

### Step 1: CLI scaffold
**Status:** ✅ Complete

- [x] Implement spine tasks from-issue (`--closes`/`--partial`, `--id`, `--slug`, `--next-id`, `--gh`, `--json`; exit 0/1/2)
- [x] Mission Closes/Partial + incomplete Contract stubs (empty Contract table → validate fails until operator fills)
- [x] No silent dependencies.json edges (never written; CONTEXT.md read-only unless `--next-id`)

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Skill + validate-after-fill docs (SKILL.md § Hydrate from a GitHub issue + DoR item; upstream workflow hydrate path; runbook empty-Contract fix row)
- [x] Golden fixture (tests/tasks/from-issue.test.mjs — scaffold shape, validate-fails-empty → passes-after-fill, 11 tests, 98.92% lines on from-issue.mjs)
- [x] Contract testCommand passing (lint ✓, typecheck ✓, scoped suite 11/11 ✓)

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] upstream-execution-workflow updated (Dual-layer § Hydrate path: flags, empty-Contract fail-loud, no deps edges, --next-id opt-in, exit codes, validate-after-fill loop)
- [x] Discoveries logged
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Empty Contract table is the honest scaffold stub: `parseContract` reads empty cells as null, so `spine tasks validate` fails with "Contract table is empty" until the operator fills — the validate-after-fill loop falls out of existing validators, no engine change needed | Shipped as designed | `src/tasks/from-issue.mjs` (buildPromptScaffold), `tests/tasks/from-issue.test.mjs` (golden path) |
| CONTEXT.md Next Task ID read-only by default; explicit `--next-id SP-###` is the only documented write path (validates PREFIX-### format; refuses when the counter line is absent) | Shipped as designed | `src/tasks/from-issue.mjs` (readNextTaskId/updateNextTaskId), SKILL.md hydrate table |
| `gh` dependency stays test-hermetic via injectable `ghCommand` (node shim scripts in tmp dirs) — no live network in unit tests | Shipped as designed | `tests/tasks/from-issue.test.mjs` (writeGhShim) |
| SKILL.md was prelanded by SP-883 (thin packets § + mission-link example); SP-888 added the hydrate-path section + DoR item on top (amendment said mustChange removed — docs delta kept small) | Noted | `skills/create-spine-tasks/SKILL.md` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-22 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-22 | Step 0 | Preflight: subcommand dispatch, SP-883 thin-packet shape, Next Task ID convention, validate rules confirmed |
| 2026-11-22 | Step 1 | `spine tasks from-issue` shipped (`src/tasks/from-issue.mjs` + CLI wiring); smoke-tested against fake gh shim in temp project |
| 2026-11-22 | Step 2 | Golden fixture tests (11) + hydrate docs (SKILL.md, upstream workflow, runbook); Contract testCommand green; coverage 98.92% lines on from-issue.mjs |
| 2026-11-22 | Step 3 | STATUS finalized; Contract testCommand re-run verbatim, exit 0; `.DONE` created |

---

## Blockers

*None*

---

## Notes

Release v2.34.0 — #382 child (#384). Depends on SP-883.
