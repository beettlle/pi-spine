# SP-857: Runbook wait pause-retry salvage — Status

**Current Step:** Complete
**Status:** ✅ Done
**Last Updated:** 2026-11-16
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Locate runbook sections for `spine wait`, pause/retry, and salvage complete; list sentences that contradict #375/#376/#374

**Findings:**
- **#375:** wait recipes (`--until completed,needs_integrate,failed,aborted`, lines ~44/860/876) already exclude `needs_retry`, but the multi-lane wake *rule* is undocumented — nothing says `spine wait` must not match `needs_retry` while sibling lanes are `running`, nor the quiet-wave-then-add-`needs_retry` pattern.
- **#376:** `stale_engine_pid` appears nowhere. The "Single attached engine" paragraph (~L61) and SP-715 PID-reuse paragraph do not distinguish a stale paused-batch engine pid from a live attached engine; the Pause section has no pause→retry→resume recovery path.
- **#374:** salvage "Typical workflow" (~L1602) ends at `spine batch complete` but never states `complete`/`dismiss` succeed without `--force` when only salvaged failures remain. The post-DONE section (~L1618) already carries the last-resort/unreviewed warning — keep as-is.
- **Cross-link:** no release/publish pointer in the runbook; `docs/release/npm-publish.md` does not exist yet (SP-858 owns it — forward reference is intended).
- **QUICK-REFERENCE.md:** wait recipes (`--until completed,failed`) exclude `needs_retry`; salvage row already says "no `dismiss --force` needed (#292)" — no clearly-wrong one-line recipe found; gap (no multi-lane wait rule) recorded in Discoveries, not edited.

### Step 1: Wait + pause/retry + salvage docs
**Status:** ✅ Complete

- [x] Multi-lane wait wake rule (#375) — new paragraph after the `--until` pseudo-diagnosis prose + cookbook table row + quiet-wave comment on the detached-first snippet
- [x] Pause/retry/resume without stale_engine_pid / false attached ownership (#376) — new "Stale engine pid is not a live attached engine" paragraph (after SP-715) + "Pause → retry → resume" paragraph in Pause and abort
- [x] Post-salvage complete/dismiss without `--force` when heal applies (#374) — new "Finalize without `--force`" paragraph after the salvage typical workflow; existing last-resort/unreviewed warning kept intact

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Contract `testCommand` passing — `rg -l 'operator-runbook.md' tests/` → 2 hits: `tests/batch/adoption-doc-merge.test.mjs` (runnable) and `tests/fixtures/scenarios/registry.json` (fixture data, not a test file). Ran the test file plus `tests/spine-init.test.mjs` (asserts the runbook path in context.md): `node --experimental-strip-types --test --test-reporter=dot` → 14 passing, 0 failing. Full suite runs at post-integrate `release:check`.
- [x] All failures fixed — none occurred; `git diff` confirms no changes under `src/**`, `bin/**`, `scripts/**`.

### Step 3: Documentation & Delivery
**Status:** 🟡 In Progress

- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-857-runbook-wait-pause-retry-salvage/.DONE`

**Completion criteria:** all three verified in the runbook — (1) multi-lane `needs_retry` must not wake under live sibling workers (#375); (2) pause/retry/resume needs no `dismiss --force` for the #376 class; (3) post-salvage `complete`/`dismiss` succeed without `--force` when only salvaged failures remain (#374). Last-resort/unreviewed salvage warning preserved.

**Discoveries:**
- `docs/QUICK-REFERENCE.md` checked per PROMPT: its wait recipes (`--until completed,failed`) exclude `needs_retry` and its salvage row already says "no `dismiss --force` needed (#292)" — no clearly-wrong one-line recipe, so not edited. **Gap recorded:** QUICK-REFERENCE has no multi-lane wait wake rule row; a future doc packet could add the one-liner quiet-wave recipe.
- `docs/release/npm-publish.md` does not exist yet — the cross-link added in the model-pins section is an intentional forward reference; SP-858 (same release batch, wave R1) owns that file.
- `tests/fixtures/scenarios/registry.json` references the runbook as an adoption-doc-merge scenario fixture (reproduces #14 disjoint-section merge conflicts); unaffected by this change — verified by the passing `adoption-doc-merge` test.

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-16 | Task staged | PROMPT.md created |

## Blockers

*None*
