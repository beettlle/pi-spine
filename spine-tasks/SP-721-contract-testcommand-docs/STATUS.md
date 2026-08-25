# SP-721: Docs: contract testCommand vs gate evidence hardening — Status

**Current Step:** Step 3
**Status:** 🟡 In Progress
**Last Updated:** 2026-08-25
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

> **Hydration:** Checkboxes represent meaningful outcomes, not individual code changes.

---

## Step 1: Document dual execution models

**Status:** ✅ Complete

- [x] In `docs/stet-overview.md`, contrast Contract `testCommand` (shell) vs gate evidence (#254 hardened path)
- [x] Add operator-runbook note: avoid `$`, backticks, `;`, `|`, `&&`, `||` in PROMPT testCommand once SP-723 lands
- [x] Cross-link #268 / SP-723 for the code change

## Step 2: Testing & Verification

**Status:** ✅ Complete

- [x] Run contract `testCommand` only
- [x] Fix all failures from the scoped contract command — none; `grep -q 'contract testCommand' docs/stet-overview.md && grep -q 'gate evidence' docs/stet-overview.md` passed on first run

## Step 3: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] Create `.DONE`

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|
| | | | |

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|
| 2026-08-25 | `skills/create-spine-tasks/references/contract-template.md` wording ("Shell command in backticks", `&&` chain examples) does not conflict today — still accurate while contract path uses a shell. Its `&&` examples become stale once SP-723 lands. | No change made (Check-If-Affected only); SP-723 should refresh template examples when hardening lands |
| 2026-08-25 | `docs/stet-overview.md` Approaches 1 & 5 recommend `&&`-chained / env-prefixed contract testCommands (e.g. `SPINE_WORKER_STUB=1 npm test && stet run …`) — these break once SP-723 rejects metachars. New §"two execution models" warns readers; example rewrites deferred to SP-723 to keep this task docs-contrast-only | Doc guidance is forward-looking; examples updated in a future pass |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-25 | Task staged | PROMPT.md and STATUS.md created for v2.16.0 release |
| 2026-08-25 | Step 1 complete | `docs/stet-overview.md`: extension-points table annotated + new "Contract testCommand vs gate evidence: two execution models" section (prose + comparison table, #268/#254/SP-723 cross-links). `docs/adoption/operator-runbook.md` §2.3: new "testCommand execution model" paragraph with forward-compatible authoring note |
| 2026-08-25 | Step 2 complete | Contract testCommand passed (grep × 2, exit 0). No src/ or bin/ changes — fileScopeMustNotChange satisfied |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
| | | |

## Notes
