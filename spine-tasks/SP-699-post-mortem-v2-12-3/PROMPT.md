# Task: SP-699 — Post-mortem v2-12-3 release process

**Created:** 2026-08-09
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only incident writeup; no product code.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Write `docs/release/post-mortem-v2.12.3.md` capturing what went wrong in the v2.12.3 release cycle so v2.13.0 stays painless: mid-release `.spine/spine-config.json` agent pin thrash after Kimi 429 (F7/#248 violation despite SP-691 docs), SP-696 planner re-propagation abort (`task_not_found`) then option A supersede of #226 by #228, incomplete publish checklist hygiene, and the stabilization rules already encoded in `skills/spine-release-operator`. Mirror the structure of `docs/release/post-mortem-v2.12.1.md` (executive summary, chronology, failure taxonomy, do-not-reintroduce). Cite batches from `spine-tasks/_authoring/release-v2.12.3/manifest.md` and CONTEXT Phase 79.

## Dependencies

- **None**

## Context to Read First

- `docs/release/post-mortem-v2.12.1.md` — template structure
- `spine-tasks/_authoring/release-v2.12.3/manifest.md`
- `spine-tasks/CONTEXT.md` — Phase 79
- `skills/spine-release-operator/SKILL.md` — hard rules F1/F7/F8 (read-only)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/release/post-mortem-v2.12.3.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/release/post-mortem-v2.12.3.md` |
| fileScopeMustNotChange | `src/**`, `bin/**`, `tests/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm `docs/release/post-mortem-v2.12.1.md` exists as structural model
- [ ] Read v2.12.3 manifest + Phase 79 notes for chronology facts

### Step 1: Author post-mortem

- [ ] Create `docs/release/post-mortem-v2.12.3.md` with executive summary, scope/what shipped, chronology, failure taxonomy (at least: mid-release pin thrash; SP-696 abort → option A; publish checklist lag), engineering backlog pointers (#251, deferred matrix children), and "what not to reintroduce"
- [ ] Link manifest path, #226/#228/#248/#249/#250/#251, and skill hard rules without rewriting the skill

### Step 2: Testing & Verification

- [ ] Confirm deliverable path exists and covers the sections above (docs-only contract)
- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test` from repo root (docs-only full suite)

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/release/post-mortem-v2.12.3.md`

**Check If Affected:**
- `skills/spine-release-operator/SKILL.md` — already encodes gates; do not edit in this task

## Completion Criteria

- [ ] Post-mortem committed at the File Scope path
- [ ] Mid-release pin thrash and SP-696 option A called out with do-not-reintroduce
- [ ] Links to v2.12.3 manifest and related issues present

## Do NOT

- Edit product code under `src/**` or `bin/**`
- Edit `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Re-open planner virtual matrix row ID designs
- Skip the Testing step

## Git Commit Convention

- `docs(SP-699): post-mortem v2.12.3 release process`
