# Task: SP-747 — Gate approve/reject optional synthesis note

**Created:** 2026-09-05
**Size:** S

## Review Level: 2 (Plan and Code)

**Risk:** Additive optional CLI flag on integrate gate; persistence on gate record; low blast radius if null-default preserved.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #280 — Add optional `--synthesis "..."` on `spine gate approve` / `reject` (I-PASS-lite receiver readback). Persist on the gate record; show via `spine gate status` when present. Approve/reject without the flag remains non-breaking (`synthesis` null). Auto-approve leaves synthesis null or `"auto"`. Document the gate subsection in `docs/adoption/operator-runbook.md` only.

## Dependencies

- **None**

## Context to Read First

- GitHub #280 — synthesis note brief
- `src/batch/gate-posture-approve.mjs` — approve/reject persistence
- `src/batch/gate.mjs` — gate load/save / status surface
- `bin/spine-gate.mjs` — CLI argv
- Related: #43, #278 (handoff quality; do not rework diagnose)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-gate.mjs`
- `src/batch/gate-posture-approve.mjs`
- `src/batch/gate.mjs`
- `tests/batch/gate-posture-wire-approve.test.mjs`
- `tests/batch/gate.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/gate-posture-wire-approve.test.mjs tests/batch/gate.test.mjs tests/batch/gate-posture-stamp.test.mjs` |
| fileScopeMustChange | `bin/spine-gate.mjs`, `src/batch/gate-posture-approve.mjs`, `docs/adoption/operator-runbook.md` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Map approve/reject persistence fields and `spine gate status` printer
- [ ] Confirm auto-approve path and gate.json schema consumers

### Step 1: CLI + persistence

- [ ] Parse optional `--synthesis` on approve and reject
- [ ] Persist `synthesis` string on gate record; omit/null when flag absent
- [ ] Auto-approve sets synthesis null or `"auto"` (document choice in STATUS)
- [ ] `spine gate status` displays synthesis when present

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures
- [ ] Cover: approve with synthesis; approve without; reject with synthesis; status shows text

### Step 3: Documentation & Delivery

- [ ] Update gate subsection in `docs/adoption/operator-runbook.md`
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md` — gate approve/reject `--synthesis` behavior

**Check If Affected:**

- `docs/QUICK-REFERENCE.md` — only if gate CLI cheatsheet lists approve flags

## Completion Criteria

- [ ] `spine gate approve --synthesis '…'` persists text
- [ ] `spine gate status` shows it
- [ ] Approve without flag still works (synthesis null)
- [ ] Reject accepts synthesis
- [ ] Empty synthesis is not required (v1 non-blocking)
- [ ] Closes #280
- [ ] `.DONE` created

## Do NOT

- Make synthesis mandatory
- Change diagnose/handoff SBAR fields (#278/#279)
- Scrape or invent synthesis from evidence automatically
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `feat(SP-747): optional gate approve synthesis (#280)`
