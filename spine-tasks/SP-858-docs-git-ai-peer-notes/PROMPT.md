# Task: SP-858 — Release gate notes: git-ai refs/notes + peer pi 1.5.2

**Created:** 2026-11-16
**Size:** S
**Type:** llm

## Review Level: 0 (None)

**Risk:** Docs-only. Without notes, local `release:check` keeps failing on git-ai hosts and operators miss the peer bump.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** #372 fails `mutating-help` when git-ai annotates temp repos with `refs/notes/ai`. SP-859 fixes the snapshot; operators still need a release-gate note and a short peer-pi 1.5.2 note for SP-864.

## Mission

Release / operator docs mention the git-ai `refs/notes` hazard and the peer bump:

1. **Release / npm-publish or runbook release-gate section** — Note that hosts running `git-ai` may annotate temp repos with `refs/notes/*`; after SP-859 the mutating-help snapshot ignores those refs. Until SP-859 lands, workaround remains `git-ai bg shutdown` around `release:check`.
2. **Peer runtime** — Note that this release bumps the lockfile / floor to `@earendil-works/pi-coding-agent` 1.5.2 (SP-864); installed `pi` on the release host is already 1.5.2.

Put the notes in `docs/release/npm-publish.md` only (SP-857 owns `docs/adoption/operator-runbook.md` — do not edit the runbook here). A one-line "see npm-publish" pointer belongs in SP-857 if needed.

## Dependencies

- **None**

## Context to Read First

- GitHub #372
- `docs/release/npm-publish.md`
- `spine-tasks/_authoring/release-v2.31.0/manifest.md` Dependency drift

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/release/npm-publish.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/release/npm-publish.md` |
| fileScopeMustNotChange | `src/**`, `bin/**`, `scripts/**`, `package.json`, `package-lock.json`, `docs/adoption/operator-runbook.md` |

## Steps

### Step 0: Preflight

- [ ] Find existing release-check / pre-publish sections in npm-publish.md; note where git-ai and peer version belong

### Step 1: Docs

- [ ] git-ai `refs/notes` hazard + SP-859 ignore + temporary workaround
- [ ] Peer `pi-coding-agent` 1.5.2 note for this release

**Artifacts:**
- `docs/release/npm-publish.md` (modified)

### Step 2: Testing & Verification

- [ ] `rg -l 'npm-publish.md|operator-runbook.md' tests/` and run only the hits (none → note in STATUS)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-858-docs-git-ai-peer-notes/.DONE`

## Documentation Requirements

**Must Update:**
- `docs/release/npm-publish.md` — git-ai notes + peer 1.5.2

**Check If Affected:**
- None (runbook is SP-857)

## Completion Criteria

- [ ] npm-publish documents git-ai `refs/notes` vs mutating-help / release:check
- [ ] Peer pi-coding-agent 1.5.2 for v2.31.0 is mentioned

## Git Commit Convention

- `docs(SP-858): git-ai notes and peer pi 1.5.2 release gate notes`

## Do NOT

- Edit `docs/adoption/operator-runbook.md` (SP-857)
- Edit `src/`, `bin/`, `scripts/`, or lockfiles (SP-859 / SP-864 own those)
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
