# Task: SP-300 — README trim inventory

**Created:** 2026-06-18
**Size:** S

## Review Level: 0 (None)

**Assessment:** Read-only explore artifact; no product code or README edits.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-300-readme-trim-inventory/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Map every `##` / `###` section in the root README to a keep/trim/move/delete action and destination doc. Record line-count baseline, PRD ID grep hits, and version-label drift so SP-301–305 can execute without re-reading the full 600-line README.

## Dependencies

- **None**

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `README.md` — inventory source
- `skills/create-spine-tasks/references/explore-template.md` — findings schema
- `docs/QUICK-REFERENCE.md` — check for existing coverage of README quickstart topics
- `docs/EXECUTION-FLOW.md` — lifecycle content home
- `docs/adoption/operator-runbook.md` — operator playbook home

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `spine-tasks/_explore/readme-trim/findings.md`
- `spine-tasks/CONTEXT.md` (explore link + Phase 33 row only)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| artifactsMustExist | `spine-tasks/_explore/readme-trim/findings.md` |

## Steps

### Step 0: Preflight

- [ ] Run `wc -l README.md` and record baseline line count
- [ ] Run `rg 'FR-|GAP-|NFR-|§' README.md` and list matches
- [ ] List all `##` headings with line ranges (`rg '^## ' README.md` + manual `###` under Quick start)

### Step 1: Write findings

- [ ] Create `spine-tasks/_explore/readme-trim/findings.md` per explore template (Summary, Codebase areas, Risks, Suggested file scopes, Open questions)
- [ ] Include section map table: section → action (keep/trim/move/delete) → destination path
- [ ] Note version drift: "Honest limits (v2.2)" vs "Project status v1.0.2" vs `package.json`
- [ ] Set target README budget: ≤180 lines
- [ ] Flag SP-276 Best-of-N section for trim/link-only in SP-302

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Add explore link in `spine-tasks/CONTEXT.md` Phase 33 table
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `spine-tasks/_explore/readme-trim/findings.md` — new explore artifact
- `spine-tasks/CONTEXT.md` — explore row only

**Check If Affected:**
- None

## Completion Criteria

- [ ] findings.md complete with section map and grep inventory
- [ ] CONTEXT.md links explore slug `readme-trim`
- [ ] All tests passing
- [ ] `.DONE` created

## Git Commit Convention

- `docs(SP-300): complete Step N — description`
- `fix(SP-300): description`

## Do NOT

- Edit `README.md` or other product docs (inventory only)
- Expand scope beyond File Scope without replan
- Skip tests

---

## Amendments (Added During Execution)
