# SP-742: LLM matrix rows get per-row PROMPT substitution — Status

**Current Step:** Step 1
**Status:** 🟣 In Progress
**Last Updated:** 2026-09-02
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-740 `.DONE` on main (runbook ownership) — `git show main:spine-tasks/SP-740-gate-reopen-completed/.DONE` resolves; SP-740 landed in 3237ce46/15a9a9f6.
- [x] Read LLM branch in `matrix-run.mjs` and SP-670 helpers — see Plan below.

### Plan (Step 1 approach)

1. Add `applyMatrixRowToPrompt(promptText, row)` to `src/planner/matrix.mjs` — whole-document `{matrix.*}` substitution built on `substituteMatrixVariables` (SP-670 engine). Rationale: the worker consumes raw PROMPT markdown; no prompt re-serializer exists, so serving requires whole-doc substitution. It is a superset of `applyMatrixRowToSteps` + `applyMatrixRowToContract` + File Scope paths with identical fail-loud semantics and identical empty-row guard.
2. Wire into the LLM branch of `runMatrixSubLane` (`src/batch/engine-lanes/matrix-run.mjs`):
   - After worktree provision, before worker run: build substituted PROMPT from parent `PROMPT.md` (same source convention as `readParentContract`), write it to the row worktree's `PROMPT.md`. Unknown `{matrix.X}` ref throws → row fails loud with `matrix row prompt substitution failed: …`.
   - Journal `matrix.sub_lane.prompt_served` with sha256 + char count so operators can verify per-row substitution (narrows runbook §2.4 caveat).
   - After a successful `runWorker`: restore the authored PROMPT.md (`git checkout --`) and delete the row's `.DONE` before the per-row commit. Otherwise each row branch would commit a different PROMPT.md and a timestamp-stamped `.DONE`, add/add-conflicting the row→lane merge (SP-697) on every multi-row LLM matrix task. Parent already writes the lane `.DONE` after merges.
   - Attach `servedPrompt` to the row result for diagnostics/tests.
   - Execute+matrix path untouched (GitNexus impact on `runMatrixSubLane`: LOW, 2 upstream callers).
3. Tests: unit tests for `applyMatrixRowToPrompt` (matrix-subst.test.mjs); integration tests driving `runMatrixSubLane` directly under `SPINE_WORKER_STUB=1` (two rows → distinct served PROMPT with substituted steps/contract/file-scope; unknown ref fails loud); startBatch e2e (LLM matrix, 2 rows → batch ok, distinct `prompt_served` shas, authored PROMPT.md unchanged on orch branch).
4. Runbook §2.4: replace LLM caveat with per-row substitution contract + `prompt_served` verification.

---

### Step 1: Wire substitution into LLM rows
**Status:** ⬜ Not Started

- [ ] Before `runWorker`, write/serve row-substituted steps + contract (+ file-scope) into the row worktree PROMPT
- [ ] Fail loud on unknown `{matrix.*}` refs (existing helper behavior)
- [ ] Keep execute+matrix path unchanged / recommended for pure compute

---

### Step 2: Tests + runbook §2.4
**Status:** ⬜ Not Started

- [ ] Stub/integration: two rows → worker sees distinct substituted content
- [ ] Remove or narrow §2.4 LLM substitution caveat

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint
- [ ] Run Contract testCommand

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Docs updates
- [ ] Create `.DONE`
