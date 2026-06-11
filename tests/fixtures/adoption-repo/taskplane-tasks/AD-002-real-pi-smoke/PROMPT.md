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

## Testing

Verification only — this fixture has no npm test. Confirm `REAL-PI-SMOKE.txt` exists with a valid ISO-8601 UTC timestamp.

## Steps

### Step 1: Write smoke marker

> **Plan-review checkpoint**

- [ ] Create `REAL-PI-SMOKE.txt` with an ISO-8601 UTC timestamp on the first line
- [ ] Update STATUS.md and call `spine_report_progress` (or `spine report progress`)
- [ ] Call `spine_review_step` (or `spine review step --step 1 --type plan`); on REVISE, fix before continuing
- [ ] Create `taskplane-tasks/AD-002-real-pi-smoke/.DONE` only after plan review APPROVE and completion criteria met

## Completion Criteria

- [ ] `REAL-PI-SMOKE.txt` exists in the lane worktree with a valid timestamp
- [ ] Plan review for Step 1 executed and APPROVED (Review Level 1)
- [ ] `.DONE` marker in task folder

## Do NOT

- Modify files outside File Scope
- Run npm test (this fixture has no package.json)
- Create `.DONE` before plan review APPROVE

## Environment

- **Worker mode:** `SPINE_WORKER_STUB=0` (real `pi` on PATH)
- **Tools:** Prefer `spine_review_step`, `spine_report_progress` over bash when available

---

## Amendments (Added During Execution)
