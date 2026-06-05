# Task: SP-106 — Brutal audit: batch engine & reliability

**Created:** 2026-06-05
**Size:** M

## Review Level: 0 (None)

**Assessment:** Read-only audit of batch orchestration, resume, stall recovery, and incident regressions. No production code changes — report only.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 1, Reversibility: 0

## Mission

Conduct a **brutal audit** of pi-spine batch orchestration reliability after Phases 11–19 (stall recovery, orphan running, resume parallel lanes, devcontainer worktrees, launch diagnosis). Verify the codebase against `.cursor/rules/javascript-3-brutal-audit.mdc` Sections A, D, E, X within this scope. Produce `AUDIT-REPORT.md` with severity-rated findings, cleanliness score, top 10 refactor targets, and remediation task recommendations.

**Do not fix code** — audit and report only.

## Dependencies

- **None**

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md` — Phases 11–19 incident history

**Tier 3:**
- `.cursor/rules/javascript-3-brutal-audit.mdc` — audit format and anti-pattern sections
- `docs/incidents/` — prior consumer bug reports
- `pi-spine-PRD.md` §18 (resume/stall semantics)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

> Read/analyze only within scope. Report may reference out-of-scope files as cross-links but must not propose edits outside scope.

- `src/batch/**`
- `src/worker-tools/**`
- `tests/batch/**`
- `tests/fixtures/incidents/**`
- `docs/incidents/**` (read for cross-reference)

## Steps

### Step 0: Preflight

- [ ] Read CONTEXT Phases 11–19 and incident docs
- [ ] Run baseline: `npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test -- tests/batch/` (record pass/fail count)
- [ ] Inventory module sizes under `src/batch/` (line counts, god-file candidates)

### Step 1: Deep reliability audit

> ⚠️ Hydrate: Expand checkboxes per incident class and module discovered in Step 0

- [ ] **Orphan/resume:** grep `phase.*running`, `orphan`, `resume`, `enginePid`, `workerPhase` — verify SP-082–098 coverage vs remaining gaps
- [ ] **Stall recovery:** audit FR-STALL-01–03 paths — output capture, checkpoint warnings, salvage, autoCommitOnStall
- [ ] **Launch failures:** audit SP-101–105 staging gaps — worktree gitdir, PI_SPINE_ROOT, hook runner, lane commit, diagnosis taxonomy
- [ ] **Journal/state integrity:** batch-state vs journal drift, silent parse degradation, reconciliation false positives/negatives
- [ ] **Error handling:** empty catch, swallowed errors, generic `needs_retry` without context
- [ ] **Test gaps:** incident fixtures missing for known consumer reports; untested failure classes

**Artifacts:**
- Notes in STATUS.md Discoveries table

### Step 2: Write AUDIT-REPORT.md

- [ ] Executive summary + **cleanliness score /10**
- [ ] Findings in mandatory format (🚨 severity, 📍 file, ❌ issue, ✅ fix, ⏱️ effort)
- [ ] Top 10 files/modules requiring attention
- [ ] Recommended spine remediation tasks (IDs TBD — prefix `SP-1xx`)
- [ ] End with: **Ready for next remediation wave? YES/NO**

**Artifacts:**
- `spine-tasks/SP-106-audit-batch-reliability/AUDIT-REPORT.md` (new)

### Step 3: Documentation & Delivery

- [ ] STATUS.md complete with discoveries
- [ ] No code or test changes outside task folder
- [ ] Create `.DONE` marker

## Documentation Requirements

**Must Update:**
- `spine-tasks/SP-106-audit-batch-reliability/AUDIT-REPORT.md` (new)
- `spine-tasks/SP-106-audit-batch-reliability/STATUS.md`

**Check If Affected:**
- None (do not edit product docs in an audit task)

## Completion Criteria

- [ ] AUDIT-REPORT.md published with ≥5 substantive findings (or explicit "no issues" evidence)
- [ ] Baseline batch tests recorded
- [ ] `.DONE` created

## Git Commit Convention

- `docs(SP-106): batch reliability brutal audit report`

## Do NOT

- Modify `src/**` or `tests/**` (audit-only task)
- Fix issues inline — defer to remediation tasks
- Skip grep/code verification — no vibe auditing

---

## Amendments (Added During Execution)
