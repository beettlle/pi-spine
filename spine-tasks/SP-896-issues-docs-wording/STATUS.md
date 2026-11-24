# SP-896: Docs issue tracker wording — Status

**Current Step:** Step 1
**Status:** 🟡 In progress
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
**Status:** ⚪ Pending

- [ ] Runbook + skills + upstream workflow

---

### Step 2: Testing & Verification
**Status:** ⚪ Pending

- [ ] rg verification

---

### Step 3: Documentation & Delivery
**Status:** ⚪ Pending

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-23 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-24 | Step 0 preflight | SP-895 merged (0cd956f0); code names confirmed: `integrations.issues` (`provider` default "github"), `--no-issue-sync`, `--issue-label` (old `--github-label` rejected), journal `issues.synced`/`issues.sync_failed`. Old strings remain in: operator-runbook.md (board selection + §4.4), release-operator §4.3c, agent-orchestrated-waves.md:102, spine-orchestrate-waves SKILL.md:82. Heading anchors to update: runbook `#board-selection-github-labelmilestone…` (linked from agent-orchestrated-waves.md), runbook `#44-github-issue-sync-on-land…` (linked from runbook:524), create-spine-tasks `#hydrate-from-a-github-issue…` (self-link at :627) |

---

## Blockers

*None*

---

## Notes

Release v2.35.0 — Closes #387.
