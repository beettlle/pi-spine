# Task: SP-768 — Wave C: bump CI/release/real-pi Actions majors

**Created:** 2026-09-26
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Workflow pin bumps can break CI/release OIDC stage or the github-script CI gate. Keep script logic identical; only bump action majors.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** #285 Wave C — workflows still on checkout/setup-node/upload-artifact **v4** and github-script **v7** while current majors are **v7** / **v9**.

## Mission

Partial #285 — Complete **Wave C** only: bump GitHub Actions in `ci.yml`, `release.yml`, and `real-pi.yml` to current majors (`actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`, `actions/github-script@v9`). Preserve release OIDC / Trusted Publisher behavior and the inline github-script CI-gate logic (no `require('@actions/github')`). Do **not** bump TypeScript 7, `@types/node` 26, or pi peer (already on 0.87).

## Dependencies

- **None**

## Context to Read First

- GitHub #285 — Wave C acceptance criteria
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml` — OIDC stage + github-script CI gate
- `.github/workflows/real-pi.yml`
- `spine-tasks/SP-755-bump-pi-peer-audit/PROMPT.md` — prior #285 wave pattern (do not re-do Waves A–B)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (pin edits only; CI validates on push)

## File Scope

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/workflows/real-pi.yml`
- `scripts/verify-actions-wave-c.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && node scripts/verify-actions-wave-c.mjs` |
| fileScopeMustChange | `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.github/workflows/real-pi.yml` |

## Steps

### Step 0: Preflight

- [ ] Record current `uses:` pins in the three workflow files
- [ ] Confirm Waves A–B already landed (peer ≥0.85, TS6/ESLint10) — Wave C only
- [ ] Dependencies satisfied

### Step 1: Bump Actions majors

- [ ] `actions/checkout@v4` → `@v7` in ci.yml, release.yml, real-pi.yml
- [ ] `actions/setup-node@v4` → `@v7` in all three (keep node-version 22, cache, registry-url on release)
- [ ] `actions/upload-artifact@v4` → `@v7` in ci.yml
- [ ] `actions/github-script@v7` → `@v9` in release.yml; keep inline script semantics
- [ ] Do not change job permissions / OIDC `id-token: write` / stage publish steps except action pins

**Artifacts:**
- `.github/workflows/ci.yml` (modified)
- `.github/workflows/release.yml` (modified)
- `.github/workflows/real-pi.yml` (modified)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md (note docs deferred to SP-769)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- None (docs deferred to SP-769)

**Check If Affected:**

- `docs/release/npm-publish.md` — Action version mentions (SP-769 owns)

## Completion Criteria

- [ ] All three workflows use checkout/setup-node **v7**; upload-artifact **v7** where present; github-script **v9** on release
- [ ] No remaining `@v4` checkout/setup-node/upload-artifact or github-script `@v7` in those three files
- [ ] Contract green
- [ ] Partial #285 (full close via SP-769)

## Git Commit Convention

- `ci(SP-768): bump Actions majors to v7 / github-script v9 (#285 Wave C)`

## Do NOT

- Bump TypeScript 7, `@types/node` 26, or pi-coding-agent peer
- Rewrite release OIDC / stage publish logic
- Close #285 (SP-769 closes after docs)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
