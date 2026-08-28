# Task: SP-733 — Break resume path import of engine-lanes facade

**Created:** 2026-08-28
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Resume modules import `engine-lanes.mjs` facade for merge/queue helpers; refactor to leaf imports shrinks allowlisted cycles.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Partial #267 — Stop resume modules from importing `./engine-lanes.mjs` facade. Import `mergeWaveLanesToOrch`, `mergeLaneToOrch`, and `loadTaskFileScopePaths` from leaf modules (`engine-lanes/merge.mjs`, `engine-lanes/queue.mjs`) or a thin re-export leaf that does not pull the full facade graph. Shrink `ALLOWED_CLUSTER_CYCLES` entries that traverse `resume-multi.mjs -> engine-lanes.mjs`.

## Dependencies

- **Task:** SP-732 (fake-async on `mergeWaveLanesToOrch` / queue — land first to avoid merge.mjs conflicts)

## Context to Read First

- GitHub #267 — proposed solution steps 1–2
- `tests/arch/import-cycles.test.mjs` — `ALLOWED_CLUSTER_CYCLES`
- `src/batch/resume-multi.mjs`, `src/batch/resume.mjs`, `src/batch/resume-common.mjs`
- Closed #83 / SP-432 leaf patterns (`detached-spawn.mjs`, `gate-evidence-read.mjs`)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/resume-multi.mjs`
- `src/batch/resume.mjs`
- `src/batch/resume-common.mjs`
- `src/batch/engine-lanes/merge.mjs`
- `src/batch/engine-lanes/queue.mjs`
- `tests/arch/import-cycles.test.mjs`
- `tests/batch/resume-multi-validation.test.mjs`
- `tests/batch/resume-multi-integration.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/import-cycles.test.mjs tests/batch/resume-multi-validation.test.mjs tests/batch/resume-multi-integration.test.mjs` |
| fileScopeMustChange | `src/batch/resume-multi.mjs` |

## Steps

### Step 0: Preflight

- [ ] Run import-cycles test; record cycles containing `resume-multi.mjs -> engine-lanes.mjs`
- [ ] Confirm SP-732 landed on `main`

### Step 1: Leaf imports for resume merge helpers

- [ ] Replace `from "./engine-lanes.mjs"` with leaf imports in resume-multi / resume / resume-common
- [ ] Add thin re-export leaf only if needed to avoid circular static imports

### Step 2: Shrink allowlist

- [ ] Remove allowlist strings eliminated by this refactor from `ALLOWED_CLUSTER_CYCLES`
- [ ] Document remaining cycles in test comment (transitional)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**

- `spine-tasks/CONTEXT.md` — phase row on land

## Completion Criteria

- [ ] Resume modules do not import `./engine-lanes.mjs`
- [ ] Allowlist shrunk; import-cycles test passes
- [ ] `.DONE` created

## Do NOT

- Rewrite reconcile semantics or merge FSM
- Empty the full allowlist (SP-736 owns final empty set)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus (#149)

## Git Commit Convention

- `refactor(SP-733): resume leaf imports break engine-lanes facade cycle (#267)`
