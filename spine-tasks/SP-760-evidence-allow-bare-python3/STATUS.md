# SP-760: Allow bare python3 in gate evidence — Status

**Current Step:** Complete
**Status:** ✅ All steps complete — ready for .DONE
**Last Updated:** 2026-09-21
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm bare python3 rejected today
- [x] Confirm .venv/bin/python3 still accepted
- [x] Dependencies satisfied

### Step 1: Allow bare python3
**Status:** ✅ Complete

- [x] Add python3 to ALLOWED_EVIDENCE_EXECUTABLES
- [x] Keep reject unknown / metachar
- [x] Unit tests allow bare python3

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint
- [x] Run Contract testCommand
- [x] Fix all failures

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged
- [x] Create .DONE

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Preflight: `python3 -m pytest -q` → `EvidenceCommandError: evidence executable not allowed: python3` (verified by direct parse, 2026-09-21) | Confirms #290 | src/batch/evidence-command.mjs `parseEvidenceSegmentArgv` |
| Preflight: `.venv/bin/python3 -m pytest -q` parses fine via `isAllowedProjectLocalInterpreter` | venv rule intact pre-change | src/batch/evidence-command.mjs |
| GitNexus impact on `ALLOWED_EVIDENCE_EXECUTABLES`: LOW risk, 0 direct upstream callers (consumed in-module by `parseEvidenceSegmentArgv`; doctor consumes via `parseEvidenceCommandChain`) | Safe to extend set | src/batch/evidence-command.mjs |
| Adding bare `python3` to the allowlist means any first token with basename `python3` is accepted (incl. absolute/relative paths), matching existing npm/node/cargo semantics; bare `python` stays rejected (existing test "rejects bare python" retained) | Accepted parity behavior; chain mode also gains python3 (consistent with node/npm) | src/batch/evidence-command.mjs |
| `docs/stet-overview.md:30` allowlist prose omits `python3`; `docs/adoption/operator-runbook.md:1559` (#199 row) and `:1620` (Phase A table) list the old first-token set | Out of File Scope — owned by SP-765/SP-766 per PROMPT Must Update: None | docs/stet-overview.md, docs/adoption/operator-runbook.md |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-09-21 | Task staged | PROMPT.md and STATUS.md created for v2.22.0 |
| 2026-09-21 | Step 0 preflight | Bare python3 rejected, venv rule intact, deps satisfied |
| 2026-09-21 | Plan review checkpoint (step 1, type=plan) | skipped per SP-195 — engine runs review after .DONE |
| 2026-09-21 | Step 1 implemented | python3 added to allowlist; 3 tests added/updated; targeted file 28/28 pass; doctor stops warning for bare python3, still warns bare python |
| 2026-09-21 | Step 2 verification | `npm run lint` exit 0; `npm run typecheck` exit 0; Contract testCommand 28/28 pass exit 0 |
| 2026-09-21 | detect_changes vs main | 1 touched symbol (doc comment), 3 files, risk LOW, 0 affected processes |
| 2026-09-21 | Step 3 delivery | STATUS finalized; .DONE created |

---

## Plan (Review Level 1)

1. Add `"python3"` to `ALLOWED_EVIDENCE_EXECUTABLES` in `src/batch/evidence-command.mjs`. Do **not** add `python` — existing test "parseEvidenceCommandArgv rejects bare python" must keep passing and PROMPT says add `python` only if tests/docs require parity (they don't).
2. Update the `ALLOWED_PROJECT_LOCAL_INTERPRETERS` doc comment so it no longer implies bare `python3` is rejected overall (the venv rule itself is unchanged).
3. Tests in `tests/batch/evidence.test.mjs`: add "accepts bare python3" test; keep bare-`python` rejection and metachar/unknown-binary rejections.
4. Step 2: run `npm run lint` and Contract `testCommand`.

---

## Blockers

*None*

---

## Notes

Doctor `evidence-safe` checks consume `parseEvidenceCommandChain`, so adding `python3` to the allowlist automatically stops the doctor warning for bare python3 evidence commands — no doctor-code change needed (file scope stays code-only per PROMPT).
