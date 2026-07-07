# Task: SP-518 — Attached SIGKILL orphan guard

**Created:** 2026-07-07
**Size:** S

## Review Level: 0 (None)

**Assessment:** Doctor warn + runbook; partial #163 mitigation.
**Score:** 2/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Partial fix for [#163](https://github.com/beettlle/pi-spine/issues/163): when operator shell backgrounds or receives SIGKILL (exit 137), attached batch orphans. Add `spine doctor` warning and operator runbook section; document detached resume as release default (full engine fix deferred to v1.10.0).

**Closes:** [#163](https://github.com/beettlle/pi-spine/issues/163) (Partial)

## Dependencies

- **None**

## File Scope

- `bin/spine-doctor.mjs`
- `docs/adoption/operator-runbook.md`
- `skills/spine-autonomous-operator/SKILL.md`
- `tests/cli/doctor-attached-orphan-warn.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/cli/doctor-attached-orphan-warn.test.mjs` |
| fileScopeMustChange | `bin/spine-doctor.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read #163 and #185

### Step 1: Doctor warn

- [ ] Detect attached batch risk (TTY detached, background resume patterns)

### Step 2: Docs

- [ ] Runbook + autonomous-operator hard rule for detached resume

### Step 3: Testing & Verification

- [ ] Run contract testCommand
- [ ] Doctor warning test passes

### Step 4: Documentation & Delivery

- [ ] Comment Partial on #163
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Doctor warns on attached orphan risk patterns
- [ ] Runbook documents detached resume for release batches

## Do NOT

- Claim full #163 fix — Partial only (engine hardening is v1.10.0)
