# Task: SP-703 — Post-mortem v2-13-0 release process

**Created:** 2026-08-15
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only incident writeup; no product code.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Write `docs/release/post-mortem-v2.13.0.md` for the v2.13.0 painless-ops cycle so v2.14.0 does not repeat missed process notes. Capture what shipped (SP-699–SP-702, #251, #238), that the worker pin `kimi-coding/k3` was held (contrast v2.12.3 F-A), publish evidence (`aa56622a`, tag `v2.13.0`, Release [31759391384](https://github.com/beettlle/pi-spine/actions/runs/31759391384)), and the leftover F-C docs gap (CI cancelled / no-signal recovery belongs in SP-704, not this file's File Scope). Mirror `docs/release/post-mortem-v2.12.3.md` (executive summary, chronology, failure taxonomy, do-not-reintroduce). Cite `spine-tasks/_authoring/release-v2.13.0/manifest.md` and CONTEXT Phase 80.

## Dependencies

- **None**

## Context to Read First

- `docs/release/post-mortem-v2.12.3.md` — structural model
- `spine-tasks/_authoring/release-v2.13.0/manifest.md`
- `spine-tasks/CONTEXT.md` — Phase 80
- `skills/spine-release-operator/SKILL.md` — hard rules F1/F7/F8 (read-only)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/release/post-mortem-v2.13.0.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/release/post-mortem-v2.13.0.md` |
| fileScopeMustNotChange | `src/**`, `bin/**`, `tests/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm `docs/release/post-mortem-v2.12.3.md` exists as structural model
- [ ] Read v2.13.0 manifest + Phase 80 for chronology facts

### Step 1: Author post-mortem

- [ ] Create `docs/release/post-mortem-v2.13.0.md` with executive summary, scope/what shipped, chronology, failure taxonomy (at least: pin held vs F-A; leftover F-C docs gap pointing at SP-704), engineering backlog pointers, and "what not to reintroduce"
- [ ] Link v2.13.0 manifest, #238, #248, #249, #251, and skill hard rules without rewriting the skill or `docs/release/npm-publish.md`

### Step 2: Testing & Verification

- [ ] Confirm deliverable path exists and covers the sections above (docs-only contract)
- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test` from repo root (docs-only full suite)

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/release/post-mortem-v2.13.0.md`

**Check If Affected:**
- `docs/release/npm-publish.md` — SP-704 owns the CI no-signal recovery note
- `skills/spine-release-operator/SKILL.md` — SP-704 owns the Phase 5 gate wording

## Completion Criteria

- [ ] Post-mortem exists at the File Scope path
- [ ] v2.13.0 pin-held vs v2.12.3 F-A called out
- [ ] F-C leftover points at SP-704 without editing npm-publish or the skill
- [ ] Links to v2.13.0 manifest and related issues present

## Do NOT

- Edit product code under `src/**` or `bin/**`
- Edit `docs/release/npm-publish.md` or `skills/spine-release-operator/SKILL.md` (SP-704)
- Edit `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Re-open planner virtual matrix row ID designs
- Skip the Testing step

## Git Commit Convention

- `docs(SP-703): post-mortem v2.13.0 release process`
