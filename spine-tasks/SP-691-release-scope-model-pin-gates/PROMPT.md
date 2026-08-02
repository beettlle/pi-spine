# Task: SP-691 — Release-operator scope approval and model-pin gates

**Created:** 2026-08-02
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs/skill hardening only; no product code.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Closes #249 — Harden `skills/spine-release-operator` so Phase 4 cannot start without a recorded **"approve release scope"** in the release manifest. Ban mid-release `.spine/spine-config.json` agent pin edits unless the operator records an explicit override. Add a checklist item to push/sync `main` after each land loop when remote publish is the goal (F8). Cross-link from `docs/release/post-mortem-v2.12.1.md` is optional if already tracked; prefer linking from the skill to the post-mortem §§F1/F8.

Closes #248 — Document release model-pin policy: one worker pin for the release; escalate only on content/contract failure, not launch/quota storms. Guidance: do not mid-release edit agent pins. **Defer** optional doctor/preflight quota-risk signal to a later release.

## Dependencies

- **None**

## Context to Read First

- `skills/spine-release-operator/SKILL.md` — Hard rules, Phase 2 gate, Phase 4
- `skills/spine-release-operator/references/release-manifest-template.md`
- `docs/adoption/operator-runbook.md` — release / batch ops notes
- `docs/release/post-mortem-v2.12.1.md` — F1, F7, F8
- GitHub #249, #248
- Manifest: `spine-tasks/_authoring/release-v2.12.2/manifest.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/spine-release-operator/SKILL.md`
- `skills/spine-release-operator/references/release-manifest-template.md`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `skills/spine-release-operator/SKILL.md`, `skills/spine-release-operator/references/release-manifest-template.md`, `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `src/**`, `bin/**`, `tests/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm Phase 2 already requires "approve release scope" but Phase 4 hard rule does not yet refuse without recorded approval
- [ ] Confirm no existing hard rule bans mid-release agent pin edits

### Step 1: Harden skill + manifest template + runbook

- [ ] Add hard rules: refuse Phase 4 without `Operator approved scope: yes` (or equivalent) recorded in the release manifest; ban mid-release `.spine/spine-config.json` agent pin edits without operator override; one worker pin per release; escalate only on content/contract failure
- [ ] Update manifest template / Phase 2 gate language so approval is an explicit artifact before Phase 4
- [ ] Add land-loop checklist item: push/sync `main` after each integrate when remote publish is the goal
- [ ] Mirror the model-pin + scope-approval policy briefly in `docs/adoption/operator-runbook.md`
- [ ] Cross-link skill/runbook to post-mortem F1/F7/F8 (path only; do not rewrite the post-mortem file)

### Step 2: Testing & Verification

- [ ] Confirm File Scope deliverables exist and contain the new gates (docs-only contract)
- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test` from repo root (docs-only full suite)

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `skills/spine-release-operator/SKILL.md`
- `skills/spine-release-operator/references/release-manifest-template.md`
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- `docs/release/post-mortem-v2.12.1.md` — already tracks #249/#248; no edit required if links suffice from skill

## Completion Criteria

- [ ] Phase 4 hard-stop without recorded scope approval is documented
- [ ] Mid-release agent pin edit ban + one-pin / escalate policy documented
- [ ] Push/sync after land-loop checklist item present
- [ ] Manifest template references approval artifact
- [ ] Doctor/preflight quota signal explicitly out of scope (deferred)

## Do NOT

- Implement doctor/preflight code for quota-risk escalate targets (deferred #248 optional AC)
- Edit `.spine/spine-config.json` agent pins as part of this task
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip the Testing step

## Git Commit Convention

- `docs(SP-691): release scope approval and model-pin gates (#249, #248)`
