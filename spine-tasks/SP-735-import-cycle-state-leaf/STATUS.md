# SP-735: Break batch-state-io and meta-reconstruct cycle variants — Status

**Current Step:** Step 3
**Status:** 🔄 In Progress
**Last Updated:** 2026-08-29
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

## Step 0: Preflight

**Status:** ✅ Complete

- [x] Remaining allowlist after SP-733/734 — 11 entries; 6 contain `batch-state-io.mjs` / `batch-meta-reconstruct.mjs` variants (targets), 5 remain for SP-736 (gate-evidence-collect ×2, gate ×1, limbo↔resume-multi-validate ×2)
- [x] SP-734 integrated — commits `c8d510a9`, `3986c73e` in lane history; engine-lanes/merge no longer imports post-merge-limbo (verified in test + graph probe)

## Step 1: Leaf extraction for state-io / meta-reconstruct edges

**Status:** ✅ Complete (commit `a661f2ec`)

- [x] Break cycle imports — readers/{spine,taskplane}-state.mjs inline typedefs (phantom JSDoc type-import edges removed); batch-meta-reconstruct.mjs rewired to state-io/state-guards leaves (binding-identical)
- [x] Keep reconcile.mjs free of `engine-lanes.mjs` imports — verified by grep (no matches)

### Plan (Review Level 1) — executed with one correction

Graph probe (55 cycles enumerated) showed all 6 target cycles route through a **phantom edge**
`readers/spine-state.mjs -> reconcile.mjs` — a JSDoc type-import `import("../reconcile.mjs").NormalizedBatchState`
that the arch-test parser (correctly strict on `import(`) counts as an edge. There is **no runtime import**;
readers are already leaves. The type reference is dangling: `NormalizedBatchState` is not defined in
`reconcile.mjs` (only `ReconciliationResult`). Correction during execution: the first draft of the
replacement comment contained the literal `import("../reconcile.mjs")` text, which the text-based parser
still matched — reworded to "JSDoc type-import pointing at reconcile.mjs".

1. `src/batch/readers/spine-state.mjs` — replace dangling type-import with inline `@typedef` (doc-only, file is @ts-nocheck); reader becomes a true leaf in the graph.
2. `src/batch/readers/taskplane-state.mjs` — same dangling type-import; required (discovery D1) or a NEW unallowlisted tracked cycle surfaces once the spine-state edge is cut.
3. `src/batch/batch-meta-reconstruct.mjs` (contract must-change) — rewire `saveSpineBatchState` → `./state-io.mjs` and `clearBatchEnginePid` → `./state-guards.mjs` (binding-identical re-exports through `state.mjs`; zero semantics change). Keeps `createInitialBatchState` from `state.mjs` (defined there; state.mjs is cycle-safe after 1–2).
4. No change needed in `journal-rebuild.mjs` / `resume-multi-validate.mjs` — their target cycles close only via the phantom reader edges.
5. `reconcile.mjs` confirmed free of `engine-lanes.mjs` imports (grep).

⚠️ Impact (repo rule): `parseSpineBatchState` upstream blast radius CRITICAL (28 symbols, 8 processes). Edit is
JSDoc-only; covered by lint + typecheck + arch/resume tests.

## Step 2: Shrink allowlist

**Status:** ✅ Complete (commit `313448a9`)

- [x] Remove eliminated strings — 11 → 5 entries; removed the 6 batch-state-io / batch-meta-reconstruct variants; remaining 5 documented as SP-736 scope

**Probe evidence after fix:** total cycles 55 → 20; tracked cycles exactly the 5 remaining allowlist entries; **0 cycles contain batch-state-io.mjs or batch-meta-reconstruct.mjs**; both readers have empty batch dep lists (true leaves).

## Step 3: Testing & Verification

**Status:** 🔄 In Progress

- [x] Run lint — `npm run lint` clean (`--max-warnings 0`, eslint over src bin tests scripts)
- [x] Contract testCommand — `npm run typecheck` clean (tsconfig.json + tsconfig.batch.json); `SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/import-cycles.test.mjs tests/batch/resume-multi-validation.test.mjs` → **18 pass / 0 fail** (10 arch incl. allowlist match, 8 resume validation)
- [x] detect_changes (repo rule, pre-commit) — risk **low**, 0 changed symbols (JSDoc/import-only edits)
- [ ] Full `npm test` — running in background monitor #1 (first foreground attempt exceeded 20 min window); result recorded before .DONE

## Step 4: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] Create `.DONE`

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|
| 2026-08-29 | D1: `readers/taskplane-state.mjs` carries the same dangling `import("../reconcile.mjs")` JSDoc edge as spine-state; leaving it creates a new unallowlisted tracked cycle once spine-state edge is cut. Fix is same-pattern JSDoc typedef (logically required for the scoped change). | Edit 1 extra file outside listed scope, same pattern |
| 2026-08-29 | D2: `NormalizedBatchState` type does not exist in `reconcile.mjs` — reader JSDoc refs were dangling docs, not a real dependency. | Justifies inline typedef replacement |
| 2026-08-29 | D3: Graph probe pre-fix: 55 total cycles, 11 tracked; all 6 target cycles share the single phantom spine-state edge. | Minimal fix confirmed |
| 2026-08-29 | D4: Replacement comment containing literal `import("../reconcile.mjs")` still matched the parser regex — reworded to prose. | Detector is text-based; comments can create edges |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-28 | Task staged | v2.17.0 release Phase 3 |
| 2026-08-28 | Contract amend | fileScopeMustChange → batch-meta-reconstruct.mjs (import-cycles pre-landed by SP-733) |
| 2026-08-29 | Step 0 done | Allowlist enumerated; SP-734 integration confirmed |
| 2026-08-29 | Plan written | Step 1 plan above; graph probe evidence |
| 2026-08-29 | Plan review checkpoint | spine_review_step step 1 plan → skipped:true (SP-195 real-pi; engine reviews after .DONE) |
| 2026-08-29 | Step 1 committed | `a661f2ec` — readers leaf typedefs + meta-reconstruct leaf rewire |
| 2026-08-29 | Step 2 committed | `313448a9` — allowlist 11 → 5 |
| 2026-08-29 | Step 3 evidence | lint clean; typecheck clean; contract tests 18/18 pass; detect_changes low/0 symbols |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
