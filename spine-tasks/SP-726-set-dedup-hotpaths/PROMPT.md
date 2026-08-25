# Task: SP-726 — Replace O(N²) includes()-in-loop dedup with Set

**Created:** 2026-08-25
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Localized perf fix in parse/analyze/profile paths.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Closes #271 — Replace `array.includes`-in-loop dedup with `Set` in `parse-prompt.mjs`, `profile.mjs`, and `analyze/index.mjs`. Preserve order where required. Coordinate after SP-724 (shared analyze module).

## Dependencies

- **Task:** SP-724 (file-scope analyze probe work lands first on shared analyze path)

## Context to Read First

- `src/tasks/packet/parse-prompt.mjs`
- `src/config/cursor-rules/profile.mjs`
- `src/tasks/analyze/index.mjs`
- GitHub #271
- Parent split: none — serial after SP-724 for shared `analyze/index.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/tasks/packet/parse-prompt.mjs`
- `src/config/cursor-rules/profile.mjs`
- `src/tasks/analyze/index.mjs`
- `tests/tasks/packet/parse-prompt.test.mjs`
- `tests/config/cursor-rules/profile.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/tasks/packet/parse-prompt.test.mjs tests/config/cursor-rules/profile.test.mjs` |
| fileScopeMustChange | `src/config/cursor-rules/profile.mjs` |

## Amendments

### Amendment 1 — 2026-08-25 (operator)

**Issue:** Preflight `prelanded-file-scope` — `src/tasks/packet/parse-prompt.mjs` already changed on `main` (SP-723 wave 0 metachar validation #268), not Set dedup (#271).
**Resolution:** Redirected `fileScopeMustChange` to `profile.mjs`. File Scope still includes `parse-prompt.mjs` and `analyze/index.mjs` for Set dedup delivery.

## Steps

### Step 1: Set-based dedup

- [ ] parse-prompt: Set for ids; preserve bullet order on return
- [ ] profile: Set for seen normalization dedup
- [ ] analyze: Set for scope path sets (no behavior change in findings)

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:** none expected

## Completion Criteria

- [ ] No includes()-in-loop dedup in the three listed files
- [ ] Closes #271
- [ ] `.DONE` created

## Do NOT

- Full analyze algorithm redesign
- Modify merge.mjs / review.mjs perf
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus (#149)

## Git Commit Convention

- `perf(SP-726): Set-based dedup in parse/profile/analyze (#271)`
