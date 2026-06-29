# Task: SP-357 — Attached merge failure exit

**Created:** 2026-06-28
**Size:** S
**Split from:** SP-347

## Review Level: 1 (Plan Only)

**Assessment:** Attached mode must print merge failure headline and exit.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Part of **GitHub issue #38** (split from SP-347): attached batch CLI prints failure headline before exit on merge_blocked.

**Required behavior:**

1. Attached runner prints merge failure headline to stdout.
2. Attached process exits non-zero on merge_blocked.
3. Regression test for attached failure output.

**Closes:** [#38](https://github.com/beettlle/pi-spine/issues/38) (with sibling split tasks)

## Dependencies

- **Task:** SP-356

## File Scope

- `src/batch/attached-runner.mjs`
- `tests/batch/attached-merge-failure-exit.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/attached-merge-failure-exit.test.mjs` |
| fileScopeMustChange | `src/batch/attached-runner.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/attached-merge-failure-exit.test.mjs` |

## Steps

### Step 0: Preflight
- [ ] Read issue #38 and superseded SP-347 PROMPT

### Step 1: Implementation
- [ ] Implement required behavior

### Step 2: Testing & Verification
- [ ] Contract test passes
- [ ] FULL suite + coverage gate

### Step 3: Delivery
- [ ] Close issue #38
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Required behavior implemented
- [ ] Tests pass with coverage gate
- [ ] Issue #38 closed

## Do NOT

- Expand beyond split scope from SP-347

---
## Amendments (Added During Execution)
