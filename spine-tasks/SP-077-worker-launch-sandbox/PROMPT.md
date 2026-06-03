# Task: SP-077 — Sandbox workerLaunchScript config

**Created:** 2026-06-03
**Size:** S

## Review Level: 1 (Plan Only)

**Score:** 4/8 — Security: 2

## Mission

Validate `development.workerLaunchScript`: schema entry, path must live under project root scripts/, reject symlinks outside root, allowlist default `scripts/spine-worker-launch.sh`.

## Dependencies

- **Task:** SP-072

## File Scope

- `src/batch/worker-host.mjs`
- `bin/spine-config.mjs`
- `tests/batch/worker-host.test.mjs`

## Steps

### Step 1: Schema + path validation
- [ ] validateSpineConfig checks launch script path
- [ ] spawn refuses unsafe paths; `spine_review_step`

### Step 2: Testing & Verification
- [ ] Negative tests for traversal/symlink; FULL suite; coverage ≥77%

---

## Amendments (Added During Execution)
