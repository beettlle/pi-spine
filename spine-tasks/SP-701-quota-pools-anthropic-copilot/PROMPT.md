# Task: SP-701 — Map anthropic + github-copilot quota pool IDs

**Created:** 2026-08-09
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Extend existing pool prefix set + unit tests; no probe adapters yet.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Partial #238 — Teach `resolvePoolId` in `src/metrics/quota-snapshot.mjs` to map `anthropic/*` → `anthropic` and `github-copilot/*` → `github-copilot` (pi model ids use `github-copilot/`, not `copilot/`). Update `tests/metrics/quota-snapshot.test.mjs` accordingly. Do **not** implement live probes in this task (SP-702). Leave unmapped providers as `unknown`.

## Dependencies

- **None**

## Context to Read First

- `src/metrics/quota-snapshot.mjs` — `POOL_PREFIXES`, `resolvePoolId`
- `tests/metrics/quota-snapshot.test.mjs`
- GitHub #238
- Parent split: SP-702 will add probes + QUICK-REFERENCE (#146)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/metrics/quota-snapshot.mjs`
- `tests/metrics/quota-snapshot.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/metrics/quota-snapshot.test.mjs` |
| fileScopeMustChange | `src/metrics/quota-snapshot.mjs`, `tests/metrics/quota-snapshot.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm current `POOL_PREFIXES` is `zai`, `kimi-coding`, `google`, `cursor`
- [ ] Confirm tests assert `anthropic/*` / `github-copilot/*` currently map to `unknown`

### Step 1: Extend pool prefixes

- [ ] Add `anthropic` and `github-copilot` to `POOL_PREFIXES`
- [ ] Update unit tests for positive mappings; keep empty/inherit/unmapped → `unknown`
- [ ] Do not add probe adapters or change `quota-probes.mjs` in this task

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- _(none — docstring/comment in quota-snapshot is sufficient)_

**Check If Affected:**
- `docs/QUICK-REFERENCE.md` — deferred to SP-702 with probes

## Completion Criteria

- [ ] `resolvePoolId("anthropic/…")` → `anthropic`
- [ ] `resolvePoolId("github-copilot/…")` → `github-copilot`
- [ ] Existing known-prefix tests still pass
- [ ] No probe code changes

## Do NOT

- Implement Anthropic/Copilot probe adapters (SP-702)
- Edit `docs/QUICK-REFERENCE.md` (SP-702)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-701): map anthropic and github-copilot quota pools (#238)`
