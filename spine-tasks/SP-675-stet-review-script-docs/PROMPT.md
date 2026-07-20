# Task: SP-675 — Stet review script and Approach 2 docs

**Created:** 2026-07-20
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs + example script only; no application code.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Partial #160 — Ship `scripts/spine-evidence-review.sh` (stet start/run/finish writing under `.spine/runtime/evidence/`) and update `docs/stet-overview.md` Approach 2 to mark gate-level review as supported via `testing.review` (SP-674) and/or Phase A scripts. Cross-link operator runbook briefly.

## Dependencies

- **Task:** SP-674 (review slot must exist so docs are accurate)

## Context to Read First

- `docs/stet-overview.md` — Approach 2
- `docs/features/stet-feedback-loop-brief.md` — gate-level note
- `scripts/spine-stet-contract-run.sh` — existing stet script patterns
- `spine-tasks/SP-674-gate-review-evidence-slot/PROMPT.md`

## Environment

- **Workspace:** docs + scripts
- **Services required:** None (script must degrade gracefully if `stet` missing)

## File Scope

- `scripts/spine-evidence-review.sh`
- `docs/stet-overview.md`
- `docs/features/stet-feedback-loop-brief.md`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `scripts/spine-evidence-review.sh`, `docs/stet-overview.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-674 landed on `main`
- [ ] Read existing stet contract script for style consistency

### Step 1: Evidence review script

- [ ] Add `scripts/spine-evidence-review.sh` with `set -euo pipefail`
- [ ] Run stet start/run/finish; tee JSON to evidence path; exit non-zero only on stet hard failure (document behavior)
- [ ] If `stet` not on PATH, print clear skip/error guidance (do not invent findings)
- [ ] `chmod +x` in repo

### Step 2: Docs — Approach 2 supported

- [ ] Update `docs/stet-overview.md` Approach 2 with `testing.review` + script example
- [ ] Update feedback-loop brief gate-level bullet to “supported”
- [ ] Add short operator-runbook note for integrate-gate stet evidence

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Verify no application code changes
- [ ] Shellcheck-friendly script (no secrets; no unbounded loops)

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/stet-overview.md` — Approach 2 supported path
- `docs/features/stet-feedback-loop-brief.md` — gate-level status
- `docs/adoption/operator-runbook.md` — brief integrate-gate stet note

**Check If Affected:**
- `docs/QUICK-REFERENCE.md` — SP-682

## Completion Criteria

- [ ] Script present and documented
- [ ] Approach 2 marked supported
- [ ] Partial #160 docs/script complete (engine in SP-674)

## Do NOT

- Change `src/**` or `bin/**`
- Hard-require Ollama/stet in CI
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `docs(SP-675): stet gate evidence script + Approach 2 (#160)`
