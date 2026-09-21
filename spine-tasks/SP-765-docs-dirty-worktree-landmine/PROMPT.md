# Task: SP-765 — Document DirtyWorktree + tracked-ignore landmine

**Created:** 2026-09-21
**Size:** S

## Review Level: 0 (None)

**Risk:** Documentation only; no runtime code.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** Operators still follow hardcoded `extension/coverage` remediation and miss tracked+gitignored landmines that cause multi-lane DirtyWorktree.

## Mission

Document DirtyWorktree remediation that uses **actual dirty paths** (#288) and the new preflight/doctor warning for tracked ignore-matched paths (#289). Update the operator runbook DirtyWorktree table and QUICK-REFERENCE recovery rows. Mention bare `python3` evidence allowlist only if still inaccurate after SP-760 (optional one-line cross-link).

## Dependencies

- **Task:** SP-759
- **Task:** SP-764

## Context to Read First

- `Parent split: SP-759 / SP-764 — suggestedCommand + preflight warn`
- `docs/adoption/operator-runbook.md` — DirtyWorktree / GitignoredDirtyWorktree tables
- `docs/QUICK-REFERENCE.md`
- GitHub #288, #289

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`
- `docs/QUICK-REFERENCE.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md`, `docs/QUICK-REFERENCE.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-759/SP-764 `.DONE` behavior on main
- [ ] Dependencies satisfied

### Step 1: Document DirtyWorktree landmine

- [ ] Runbook: replace hardcoded coverage-only remediation with path-aware guidance
- [ ] Runbook/QUICK-REFERENCE: document tracked+gitignored preflight warning + `git rm --cached`
- [ ] Cross-link #288 / #289

**Artifacts:**
- `docs/adoption/operator-runbook.md` (modified)
- `docs/QUICK-REFERENCE.md` (modified)

### Step 2: Testing & Verification

- [ ] Contract `testCommand` is `true` (docs-only)
- [ ] Spot-check links and command examples

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — DirtyWorktree remediation *(also in File Scope)*
- `docs/QUICK-REFERENCE.md` — recovery row *(also in File Scope)*

**Check If Affected:**
- `docs/stet-overview.md` — only if evidence allowlist prose still wrong after SP-760

## Completion Criteria

- [ ] Docs describe path-aware DirtyWorktree remediation
- [ ] Docs describe tracked+gitignored warning

## Git Commit Convention

- `docs(SP-765): DirtyWorktree path-aware remediation and tracked-ignore warn (#288 #289)`

## Do NOT

- Change `src/**` behavior
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
