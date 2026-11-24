# SP-896: Docs issue tracker wording — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-11-24
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Dependencies satisfied (SP-895)
- [x] Grep old github-branded docs strings

---

### Step 1: Update wording
**Status:** ✅ Complete

- [x] Runbook + skills + upstream workflow

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] rg verification

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Only remaining `integrations.github` string in docs is the intentional fail-closed migration note (documents code behavior: legacy key rejected with `CONFIG_INTEGRATIONS_INVALID` + rename hint), not stale config teaching | Kept | `docs/adoption/operator-runbook.md` §4.4 setup |
| Section retitles changed 3 heading anchors; inbound links updated in same pass (runbook §4.4 self-link, agent-orchestrated-waves → runbook board selection, create-spine-tasks hydrate self-link) | Resolved | runbook:524/1410, agent-orchestrated-waves:102, create-spine-tasks:570/627 |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-23 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-24 | Step 0 preflight | SP-895 merged (0cd956f0); code names confirmed: `integrations.issues` (`provider` default "github"), `--no-issue-sync`, `--issue-label` (old `--github-label` rejected), journal `issues.synced`/`issues.sync_failed`. Old strings remain in: operator-runbook.md (board selection + §4.4), release-operator §4.3c, agent-orchestrated-waves.md:102, spine-orchestrate-waves SKILL.md:82. Heading anchors to update: runbook `#board-selection-github-labelmilestone…` (linked from agent-orchestrated-waves.md), runbook `#44-github-issue-sync-on-land…` (linked from runbook:524), create-spine-tasks `#hydrate-from-a-github-issue…` (self-link at :627) |
| 2026-11-24 | Step 1 wording | operator-runbook.md: board-selection section + commands + semantics table → `--issue-label`; §4.4 retitled "Issue sync on land", config example now `{ "issues": { "provider": "github", "syncOnLand": true } }`, journal `issues.synced`/`issues.sync_failed`, escape hatch `--no-issue-sync`, setup notes legacy `integrations.github` fail-closed rejection. release-operator §4.3c retitled "Close tracker issues…" + blockquote renamed config/journal/flag. create-spine-tasks: dual-layer seam + hydrate heading forge-neutral, self-link anchor updated. upstream-execution-workflow: "Dual-layer: issue tracker ↔ packets". agent-orchestrated-waves + spine-orchestrate-waves: `--issue-label` + neutral label wording + runbook anchor updated |
| 2026-11-24 | Steps 2-3 verify+done | New-name grep hits all 6 docs/skills files; old-name grep clean except intentional fail-closed migration note; all 3 changed heading anchors resolve. Contract testCommand `true` exit 0. No engine code touched (fileScopeMustNotChange satisfied) |

---

## Blockers

*None*

---

## Notes

Release v2.35.0 — Closes #387.
