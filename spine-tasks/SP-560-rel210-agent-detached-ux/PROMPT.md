# Task: SP-560 — agent detached orchestration UX

**Created:** 2026-07-09
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Docs sync plus dashboard diagnosis hint for parent-exit orphans.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Complete [#185](https://github.com/beettlle/pi-spine/issues/185) remaining scope (SP-534 landed skill partial):

**P0 — Documentation:**
- Add automation rule to `docs/adoption/agent-orchestrated-waves.md` and sync `skills/spine-orchestrate-waves/references/outer-loop.md`
- Cross-link operator runbook §4 — attached-first is for interactive terminals only
- Update `skills/spine-orchestrate-waves/SKILL.md` anti-patterns table (Cursor background shell + `--attached`)

**P1 — Dashboard/diagnosis:**
- When `engine_orphaned` and journal has no `engine.crash`, suggest parent-exit vs crash in diagnosis text

**Closes:** [#185](https://github.com/beettlle/pi-spine/issues/185)

## Dependencies

- **Task:** SP-553

## File Scope

- `docs/adoption/agent-orchestrated-waves.md`
- `docs/adoption/operator-runbook.md`
- `skills/spine-orchestrate-waves/SKILL.md`
- `skills/spine-orchestrate-waves/references/outer-loop.md`
- `src/batch/diagnosis.mjs`
- `tests/batch/diagnosis-parent-exit.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/diagnosis-parent-exit.test.mjs` |
| fileScopeMustChange | `src/batch/diagnosis.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #185 and SP-534 landed scope

### Step 1: Documentation

- [ ] Agent/automation detached-resume guidance in listed doc paths
- [ ] Recovery recipe: retry → resume --force → status --diagnose

### Step 2: Diagnosis UX

- [ ] Extend diagnosis when orphan without crash journal — parent-exit hint
- [ ] Link to detached-engine.log when stale `resilience.enginePid`

### Step 3: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] Full suite green

### Step 4: Documentation & Delivery

- [ ] Comment on #185
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Agent guidance discoverable from runbook + orchestrate-waves skill
- [ ] Diagnosis distinguishes parent exit from engine crash when evidence supports it

## Git Commit Convention

- `fix(SP-560): agent detached UX docs and orphan diagnosis`

## Do NOT

- Change default batch attach mode globally
