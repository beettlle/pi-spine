# Task: SP-704 — CI cancelled no-signal publish recovery

**Created:** 2026-08-15
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only publish-gate recovery; no product code.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Document the v2.12.3 F-C leftover: cancelled or missing `ci.yml` runs are **no signal**, not green and not red. Pre-tag / Phase 5 must fail closed until `conclusion: success` on current `HEAD`. Recovery: if queued/`in_progress`, wait with `gh run watch --exit-status`; if cancelled or no run exists, re-run **CI** via `workflow_dispatch` (added `edb7919d`) and wait for success. Do not `npm version` or `git push --tags` until that green run exists. Put the same rule in `docs/release/npm-publish.md` (pre-publish checklist) and `skills/spine-release-operator/SKILL.md` (Phase 5 / pre-tag CI gate).

## Dependencies

- **None**

## Context to Read First

- `docs/release/npm-publish.md` — current pre-publish checklist and CI snippet
- `skills/spine-release-operator/SKILL.md` — Phase 5 / pre-tag CI gate
- `docs/release/post-mortem-v2.12.3.md` — F-C (read-only)
- `spine-tasks/_authoring/release-v2.14.0/manifest.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/release/npm-publish.md`
- `skills/spine-release-operator/SKILL.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/release/npm-publish.md`, `skills/spine-release-operator/SKILL.md` |
| fileScopeMustNotChange | `src/**`, `bin/**`, `tests/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm current npm-publish checklist already has `gh run list --workflow ci.yml` fail-closed language
- [ ] Confirm skill Phase 5 tells operators to wait on `in_progress`/`queued` but does not mention cancelled → `workflow_dispatch`

### Step 1: Add no-signal recovery

- [ ] Update `docs/release/npm-publish.md` pre-publish checklist: cancelled / absent CI is no signal; recovery is CI `workflow_dispatch` then wait for `conclusion: success`; do not treat cancelled as green or red
- [ ] Update `skills/spine-release-operator/SKILL.md` pre-tag CI gate with the same branch (wait vs re-run vs STOP)
- [ ] Do not edit `docs/release/post-mortem-v2.13.0.md` (SP-703)

### Step 2: Testing & Verification

- [ ] Confirm both File Scope paths contain the no-signal / `workflow_dispatch` recovery
- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test` from repo root (docs-only full suite)

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/release/npm-publish.md`
- `skills/spine-release-operator/SKILL.md`

**Check If Affected:**
- `skills/spine-release-operator/references/release-manifest-template.md` — optional checklist wording; skip unless the same sentence is already there
- `docs/release/post-mortem-v2.12.3.md` — historical F-C; do not rewrite

## Completion Criteria

- [ ] npm-publish pre-publish checklist names cancelled/absent CI as no signal
- [ ] Recovery path is CI `workflow_dispatch` + wait for success
- [ ] Skill Phase 5 / pre-tag gate matches npm-publish
- [ ] No `src/**` or `bin/**` edits

## Do NOT

- Edit product code under `src/**` or `bin/**`
- Edit `docs/release/post-mortem-v2.13.0.md` (SP-703)
- Treat cancelled CI as green or as a reason to skip the pre-tag gate
- Edit `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip the Testing step

## Git Commit Convention

- `docs(SP-704): CI cancelled no-signal publish recovery`
