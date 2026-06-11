# Task: AD-003 — Real pi smoke B

**Created:** 2026-06-11
**Size:** S

## Review Level: 1 (Plan Only)

## Mission

Second disjoint real-pi adoption fixture task for multi-task E2E (Phase 22). Writes a separate marker file from AD-002.

## Dependencies

- **None**

## File Scope

- `REAL-PI-SMOKE-B.txt`

## Steps

### Step 1: Write smoke marker B

> **Plan-review checkpoint**

- [ ] Create `REAL-PI-SMOKE-B.txt` with an ISO-8601 UTC timestamp on the first line
- [ ] Update STATUS.md and call `spine_report_progress`
- [ ] Create `.DONE` after plan review APPROVE

## Completion Criteria

- [ ] `REAL-PI-SMOKE-B.txt` exists in the lane worktree
- [ ] `.DONE` marker in task folder

## Do NOT

- Modify `REAL-PI-SMOKE.txt` (AD-002 scope)
- Run npm test (fixture has no package.json)
