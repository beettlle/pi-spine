# Task: SP-494 — Stet contract integration (v1.5.0)

**Created:** 2026-07-04
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Bootstrap configuration and documentation for stet Option A integration. No spine engine code changes; lands config, hook, and operator docs before code tasks chain stet in contract verify.
**Score:** 2/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 2

## Canonical Task Folder

```
spine-tasks/SP-494-stet-contract-integration/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Land stet Option A integration for the v1.5.0 release: commit `.review/config.toml` (LM Studio + `qwen/qwen3-coder-next`), wire `worktreeSetupHook` for per-lane stet baseline, document batch policy in CONTEXT and operator runbook, and add optional issue-filing helper script. Downstream v1.5.0 code tasks depend on this bootstrap before chaining `stet run` in contract `testCommand`.

Reference: `docs/stet-overview.md` §1 (Baseline-at-Setup, Review-at-Contract).

## Dependencies

- **None**

## Context to Read First

**Tier 2 (area context):**
- `spine-tasks/CONTEXT.md` — Phase 58, stet batch policy

**Tier 3 (load only if needed):**
- `docs/stet-overview.md` — Option A integration
- `.cursor/rules/stet-integration.mdc` — dismiss reasons

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio local server at `http://127.0.0.1:1234/v1` with `qwen/qwen3-coder-next` loaded (operator preflight)

## File Scope

- `.review/config.toml`
- `.gitignore`
- `scripts/spine-worktree-setup.sh`
- `scripts/spine-stet-file-issues.sh`
- `.spine/spine-config.json`
- `spine-tasks/CONTEXT.md`
- `docs/adoption/operator-runbook.md`
- `spine-tasks/SP-494-stet-contract-integration/**`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `spine-tasks/SP-494-stet-contract-integration/.DONE` |
| artifactsMustExist | `scripts/spine-stet-file-issues.sh`, `.review/config.toml`, `scripts/spine-worktree-setup.sh` |

## Steps

### Step 0: Preflight

- [ ] Read `docs/stet-overview.md` §1
- [ ] Confirm operator has run `stet doctor` with LM Studio (Model: `qwen/qwen3-coder-next`)

### Step 1: Verify bootstrap artifacts

- [ ] `.review/config.toml` present with provider, model, context, exclude_patterns
- [ ] `scripts/spine-worktree-setup.sh` executable; outputs `{"ok":true}` when stet available
- [ ] `.spine/spine-config.json` → `worktreeSetupHook` set to `scripts/spine-worktree-setup.sh`
- [ ] `scripts/spine-stet-file-issues.sh` executable (optional helper for finding triage)

**Artifacts:**
- `.review/config.toml`
- `scripts/spine-worktree-setup.sh`
- `scripts/spine-stet-file-issues.sh`
- `.spine/spine-config.json`

### Step 2: Documentation

- [ ] `spine-tasks/CONTEXT.md` — stet batch policy, findings → GitHub issues policy, revised batch order
- [ ] `docs/adoption/operator-runbook.md` — Stet code review (v1.5.0) subsection

**Artifacts:**
- `spine-tasks/CONTEXT.md` (modified)
- `docs/adoption/operator-runbook.md` (modified)

### Step 3: Testing & Verification

- [ ] `stet doctor` passes with LM Studio running
- [ ] `spine tasks validate SP-494`
- [ ] Fix all validation errors

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `spine-tasks/CONTEXT.md` — stet policy for v1.5.0
- `docs/adoption/operator-runbook.md` — stet preflight and triage

**Check If Affected:**
- `docs/stet-overview.md` — cross-link only if needed

## Completion Criteria

- [ ] All steps complete
- [ ] Bootstrap artifacts committed and validated
- [ ] Operator runbook documents LM Studio + stet preflight
- [ ] Downstream tasks can depend on SP-494 for stet contract chaining

## Git Commit Convention

- **Step completion:** `feat(SP-494): complete Step N — description`
- **Bug fixes:** `fix(SP-494): description`

## Do NOT

- Change spine engine code (Option A needs none)
- Add stet to this task's contract testCommand (bootstrap runs before stet is wired)
- Use gate evidence (`testing.build`) for stet — blocked until #160
- Start a spine batch during this task unless operator requests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
