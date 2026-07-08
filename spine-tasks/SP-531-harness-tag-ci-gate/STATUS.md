# SP-531: Status

**Current Step:** Step 5
**Status:** ✅ Complete
**Last Updated:** 2026-07-08
**Review Level:** see PROMPT
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read issue #156 and release.yml `ci_gate` step
- [x] Confirm SP-530 landed (release:check skill gate — `.DONE` present; Phase 5–6 gate in skill)

### Step 1: Release-operator tag gate
**Status:** ✅ Complete

- [x] Phase 6: before `git push --tags`, require `gh run list` / `gh run watch` on CI workflow for HEAD commit — fail closed if no green CI
- [x] Document release-safe profile: typecheck + lint + tests + coverage (same as `ci.yml`)

### Step 2: Workflow and docs
**Status:** ✅ Complete

- [x] Ensure `release.yml` fails publish when CI failed on tagged commit (verify or tighten messaging)
- [x] Update `docs/release/npm-publish.md` pre-publish checklist with CI gate step

### Step 3: Tests
**Status:** ✅ Complete

- [x] Add or extend `tests/cli/release-workflow.test.mjs` for CI gate documentation/skill contract strings

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Run contract `testCommand` — typecheck + 3/3 release-workflow tests pass
- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — 1832 pass / 3 fail (pre-existing: `context-phase60`, `phase23-exit`; unrelated to SP-531 scope)

### Step 5: Documentation & Delivery
**Status:** ✅ Complete

- [x] Comment on #156
- [x] Create `.DONE`

---

## Blockers

*None*

## Notes

- Commit `0293e278` — skill Phase 6 pre-tag CI gate, release.yml messaging, npm-publish checklist, contract tests
- Real-pi session: engine runs plan/code/final review after `.DONE` (no in-worker `spine_review_step`)
