# Task: SP-086 — Task sizing guardrails

**Created:** 2026-06-04
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Documentation and doctor warnings only; no runtime batch behavior change.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 2

## Mission

Prevent oversized spine task packets that cause multi-hour pi worker stalls. Strengthen **create-spine-tasks** decomposition rules (XL must split; L should split; cap implementation steps) and add **spine doctor** warnings for packets that violate sizing policy.

**Incident:** Batch `20260603T225112` ran 8 M/L tasks in parallel; pi workers hit `stall_timeout` without `.DONE` despite partial lane work.

## Dependencies

- **None**

## Context to Read First

**Tier 3:**
- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/prompt-template.md`
- `src/tasks/packet/parse-prompt.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/prompt-template.md`
- `src/doctor/task-packet-size.mjs` (new)
- `bin/spine.mjs` (wire doctor check)
- `tests/doctor/task-packet-size.test.mjs` (new)

## Steps

### Step 0: Preflight

- [ ] Read incident notes in operator runbook / batch `20260603T225112` archive if needed

### Step 1: Strengthen decomposition docs

> **Plan-review checkpoint**

- [ ] Update SKILL.md Step B: explicit XL→split table, L→prefer split, max **4** implementation steps per task (excluding Testing/Delivery)
- [ ] Add "When to split" examples (refactor engine + tests = 2 tasks; 8-task wave = 2 waves)
- [ ] Update prompt-template.md with **Size** guidance and step-count limit in checklist

### Step 2: Doctor packet-size warnings

> **Code review checkpoint**

- [ ] `buildTaskPacketSizeDoctorCheck({ tasksRoot })` warns on: Size L/XL without .DONE, >4 steps, >8 file-scope entries
- [ ] Wire into `runDoctorChecks`; warnings only (not hard fail)

### Step 3: Testing & Verification

- [ ] `tests/doctor/task-packet-size.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] `npm run coverage:check` ≥77%

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — short § on task sizing vs batch stalls

## Completion Criteria

- [ ] Skill and template encode split rules; doctor surfaces oversized pending packets
- [ ] Full test suite green

## Git Commit Convention

- `feat(SP-086): complete Step N — description`

## Do NOT

- Change stall timeout math (SP-087/088)
- Auto-split tasks at runtime

---

## Amendments (Added During Execution)
