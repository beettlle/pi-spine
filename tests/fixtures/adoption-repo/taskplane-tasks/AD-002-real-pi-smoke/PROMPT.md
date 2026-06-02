# Task: AD-002 — Real pi smoke

**Created:** 2026-06-02
**Size:** S

## Review Level: 1 (Plan Only)

## Mission

Minimal **real-pi** adoption fixture task: prove a live `pi` worker can complete one step, call `spine_report_progress`, pass plan review, and create `.DONE`.

## Dependencies

- **None**

## File Scope

- `REAL-PI-SMOKE.txt`

## Steps

### Step 1: Write smoke marker

> **Plan-review checkpoint**

- [ ] Create `REAL-PI-SMOKE.txt` with an ISO-8601 UTC timestamp on the first line
- [ ] Call `spine_report_progress` (or `spine report progress`) after marking this step complete in STATUS.md

## Completion Criteria

- [ ] `REAL-PI-SMOKE.txt` exists in the lane worktree with a valid timestamp
- [ ] Plan review for Step 1 executed (Review Level 1)

## Do NOT

- Modify files outside File Scope
- Run npm test (this fixture has no package.json)

## Environment

- **Worker mode:** `SPINE_WORKER_STUB=0` (real `pi` on PATH)
- **Tools:** Prefer `spine_review_step`, `spine_report_progress` over bash when available

---

## Amendments (Added During Execution)
