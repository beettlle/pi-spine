# Task: SP-499 — Bump pi-coding-agent and npm audit fix

**Created:** 2026-07-05
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Dependency bump and audit remediation only. No application logic changes; reversible via lockfile revert.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-499-bump-pi-coding-agent-audit-fix/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Bump `@earendil-works/pi-coding-agent` to the latest compatible version and run `npm audit fix` to resolve high-severity advisories for `protobufjs` and `undici` in the dependency tree.

**Closes:** [#180](https://github.com/beettlle/pi-spine/issues/180)

## Dependencies

- **None**

## Context to Read First

**Tier 3 (load only if needed):**
- `package.json` — current devDependency pin
- `npm audit` output — confirm protobufjs/undici highs before and after fix

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (network for npm install/audit)

## File Scope

- `package.json`
- `package-lock.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run release:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Run `npm audit` and capture current high-severity findings (protobufjs, undici)
- [ ] Note current `@earendil-works/pi-coding-agent` version in `package.json`
- [ ] Dependencies satisfied

### Step 1: Bump pi-coding-agent

- [ ] Update `@earendil-works/pi-coding-agent` in `package.json` to latest compatible semver range
- [ ] Run `npm install` to refresh `package-lock.json`
- [ ] Confirm install succeeds without peer dependency conflicts

**Artifacts:**
- `package.json` (modified)
- `package-lock.json` (modified)

### Step 2: Run npm audit fix

- [ ] Run `npm audit fix` (or targeted fixes if audit fix requires `--force` — document and escalate before using force)
- [ ] Re-run `npm audit` and confirm protobufjs/undici high advisories are resolved or documented with upstream blocker
- [ ] No unintended major dependency downgrades without operator note in STATUS.md

**Artifacts:**
- `package-lock.json` (modified)

### Step 3: Testing & Verification

- [ ] Run FULL release gate: `npm run release:check`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** (included in release:check)
- [ ] Fix all failures
- [ ] `npm audit` shows no unresolved high-severity protobufjs/undici issues

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Discoveries logged in STATUS.md (audit before/after, any blocked advisories)
- [ ] Close GitHub issue #180: `gh issue close 180 --comment "pi-coding-agent bumped; audit highs resolved — SP-499"`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — log dependency bump version if discoveries warrant

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing via `npm run release:check`
- [ ] `@earendil-works/pi-coding-agent` bumped and lockfile updated
- [ ] protobufjs/undici high advisories resolved or explicitly documented with blocker

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `chore(SP-499): complete Step N — description`
- **Bug fixes:** `fix(SP-499): description`
- **Tests:** `test(SP-499): description`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Use `npm audit fix --force` without documenting risk in STATUS.md and operator approval

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
