# SP-628: Pure posture evaluation cascade — Status

**Current Step:** Step 1 — Implement cascade + tests
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-12
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Required files and paths exist
- [x] Dependencies satisfied

### Step 1: Implement cascade + tests
**Status:** 🟡 In Progress
- [ ] Implement 5-tier evaluation returning allow-auto vs require-manual with reason
- [ ] locked / destroy / auth never auto
- [ ] Exhaustive unit tests for each tier

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Must Update docs modified (if any)
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Babysitter `evaluator.ts` is upstream reference (#123) | Adapt 5-tier cascade to pi-spine: pure input (no rule pattern engine); use SP-627 postures/`LOCKED_CATEGORIES`; `autoApproveAfterN===0` = immediate auto |
| Real-pi worker (`SPINE_WORKER_RUNNER` set, stub unset) | `spine_review_step` expected to skip; engine reviews after `.DONE` |
| GitNexus impact on LOCKED_CATEGORIES | Index stale/missing (UNKNOWN); new module has blast radius 0 until SP-632 wires it |

## Plan (Step 1)

Pure `evaluateGatePosture(input)` in `src/batch/gate-posture-evaluate.mjs` — no I/O.

**Input:** `{ category, posture, autoApproveAfterN, consecutiveApprovals?, tags?, alwaysBreakOn?, neverAutoApprove? }`

**Result:** `{ decision: "allow-auto" | "require-manual", reason: string, tier: 1..5 | null }`

**Cascade (fail-closed):**
1. `posture === "locked"` → require-manual
2. `category` in `LOCKED_CATEGORIES` or `neverAutoApprove === true` → require-manual
3. any `tags` ∩ `alwaysBreakOn` → require-manual
4. `autoApproveAfterN === 0` → allow-auto (immediate)
5. `autoApproveAfterN > 0` && streak ≥ N → allow-auto; else require-manual

Tests cover each tier + destroy/auth hard-block even if posture mis-set.

## Blockers

_None._
