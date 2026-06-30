# Task: SP-397 — Upstream issue filing docs

**Created:** 2026-06-30
**Size:** S

## Review Level: 0 (None)

**Assessment:** Documentation-only; closes #60 after SP-394/396 land.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Complete **GitHub issue #60** delivery docs: document GitHub templates (SP-394) and `spine issue draft` (SP-396) in operator materials; update upstream bug report guidance with label mapping.

**Required updates:**

1. `docs/adoption/operator-runbook.md` — new subsection (e.g. § troubleshooting or § upstream): when to file upstream, `spine issue draft` vs `spine handoff`, GitHub template links, label table (`bug` / `enhancement` / `question`)
2. `.cursor/rules/spine-operator-cursor.mdc` — extend **Upstream bug reports** with `spine issue draft --type bug` and label guidance
3. Optional: `docs/QUICK-REFERENCE.md` one-liner for `spine issue draft`

**Closes:** [#60](https://github.com/beettlle/pi-spine/issues/60)

## Dependencies

- **Task:** SP-394 (templates exist)
- **Task:** SP-396 (`spine issue draft` CLI exists)

## Context to Read First

- GitHub issue #60
- `docs/adoption/operator-runbook.md`
- `.cursor/rules/spine-operator-cursor.mdc`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`
- `.cursor/rules/spine-operator-cursor.mdc`
- `docs/QUICK-REFERENCE.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md,.cursor/rules/spine-operator-cursor.mdc` |

## Steps

### Step 0: Preflight

- [ ] Verify SP-394 templates and SP-396 CLI on main (or document intended UX from PROMPTs if batch-sequential)
- [ ] Read current upstream bug reports section

### Step 1: Runbook + operator rule

- [ ] Add upstream filing subsection with label table and draft command examples
- [ ] Update spine-operator-cursor.mdc checklist to reference templates + CLI

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (docs-only; regression guard)

### Step 3: Documentation & Delivery

- [ ] Update QUICK-REFERENCE if not done in Step 1
- [ ] Close issue #60 (`gh issue close 60 --comment "Fixed in SP-394–397: templates + spine issue draft + operator docs."`)

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`
- `.cursor/rules/spine-operator-cursor.mdc`

**Check If Affected:**
- `docs/QUICK-REFERENCE.md`

## Completion Criteria

- [ ] Operator can find label + filing workflow without reading GitHub issue #60
- [ ] Issue #60 closed with delivery comment

## Git Commit Convention

- `docs(SP-397): complete Step N — description`

## Do NOT

- Implement CLI or templates (prior tasks)
- Close #60 before SP-394 and SP-396 are on main

---

## Amendments (Added During Execution)
