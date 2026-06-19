# Task: SP-303 — README doc absorption

**Created:** 2026-06-18
**Size:** M

## Review Level: 0 (None)

**Assessment:** Gap-fill only; extend existing docs where README content was removed.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-303-readme-doc-absorption/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

After SP-302 trims README, verify removed operator content still exists in canonical docs. Add only missing paragraphs — prefer extending `QUICK-REFERENCE.md`, `EXECUTION-FLOW.md`, `operator-runbook.md`, and `bootstrap-checklist.md` over creating new files.

## Dependencies

- **Task:** SP-302 (README cuts define what to absorb)

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `spine-tasks/_explore/readme-trim/findings.md`
- `README.md` — post-SP-302 slim version
- `docs/QUICK-REFERENCE.md`
- `docs/EXECUTION-FLOW.md`
- `docs/adoption/operator-runbook.md`
- `docs/adoption/bootstrap-checklist.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/QUICK-REFERENCE.md`
- `docs/EXECUTION-FLOW.md`
- `docs/adoption/operator-runbook.md`
- `docs/adoption/bootstrap-checklist.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |

## Steps

### Step 0: Preflight

- [ ] Diff mental model: compare findings.md "move" entries vs post-SP-302 README
- [ ] For each removed topic, confirm canonical doc section exists or mark as gap

### Step 1: Gap-fill docs

- [ ] **Preflight check table** — ensure in QUICK-REFERENCE if missing
- [ ] **Diagnosis taxonomy** — ensure in QUICK-REFERENCE and/or runbook
- [ ] **Gate / integrate / limbo playbooks** — ensure runbook land loop is complete
- [ ] **Waves / lanes / ticks** — ensure EXECUTION-FLOW covers scheduling model
- [ ] **Dashboard SSE** — add to runbook or EXECUTION-FLOW if only in old README
- [ ] **Journal / heartbeat / SPINE_WORKER_STUB** — QUICK-REFERENCE troubleshooting if missing
- [ ] **create-spine-tasks skill** — bootstrap-checklist greenfield step
- [ ] **Best-of-N detail** — QUICK-REFERENCE dev-scripts subsection if trimmed from README

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Log any topics intentionally deferred in STATUS.md Discoveries
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- Only files in File Scope where gaps were found

**Check If Affected:**
- Each target doc — edit only when content was missing

## Completion Criteria

- [ ] No critical README-removed topic lacks a doc home
- [ ] Tests passing
- [ ] `.DONE` created

## Git Commit Convention

- `docs(SP-303): complete Step N — description`
- `fix(SP-303): description`

## Do NOT

- Edit `README.md`
- Duplicate content already present verbatim in target docs
- Create new markdown files outside File Scope

---

## Amendments (Added During Execution)
