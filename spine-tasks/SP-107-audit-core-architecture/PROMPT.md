# Task: SP-107 — Brutal audit: core architecture & CLI

**Created:** 2026-06-05
**Size:** M

## Review Level: 0 (None)

**Assessment:** Read-only architectural audit of planner, task parsers, config, CLI routing, and cursor-rules integration. Report only.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 1, Reversibility: 0

## Mission

Conduct a **brutal audit** of pi-spine core modules (planner, task packet parsing, spine-config, CLI entrypoints, cursor rules discovery) against `.cursor/rules/javascript-3-brutal-audit.mdc` and `.cursor/rules/general-llm-anti-patterns.mdc`. Focus on god files, ghost layers, security (shell exec, path traversal), fake async, dead code, and API workarounds. Produce `AUDIT-REPORT.md`.

**Do not fix code** — audit and report only.

## Dependencies

- **None**

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md` — Phase 13 + Phase 16 cursor rules work

**Tier 3:**
- `.cursor/rules/javascript-3-brutal-audit.mdc`
- `.cursor/rules/general-llm-anti-patterns.mdc`
- `docs/design/cursor-rules-discovery.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/planner/**`
- `src/tasks/**`
- `src/config/**`
- `bin/**`
- `tests/planner/**`
- `tests/tasks/**`
- `tests/config/**`
- `tests/spine-*.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read Phase 13 remediation list (SP-072–081) — verify claimed fixes vs current code
- [ ] Run baseline: `npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test -- tests/planner/ tests/tasks/ tests/config/` (record counts)
- [ ] Line-count inventory for `bin/spine.mjs`, `src/planner/`, `src/tasks/`, `src/config/`

### Step 1: Deep architecture audit

> ⚠️ Hydrate: Expand per module and anti-pattern category

- [ ] **A1–A6 anti-patterns:** fake async, ghost layers, dead code, O(N²) loops, API hallucinations, defensive comments
- [ ] **God files:** modules >400 LOC without clear separation; CLI router complexity
- [ ] **Security:** shell execution, path traversal, symlink handling (post SP-099), evidence/gate command allowlists
- [ ] **Config drift:** `.spine/spine-config.json` empty testing fields vs package.json scripts; FR-WORK-05 / cursor rules parity
- [ ] **PROMPT parsing:** fail-loud vs silent degradation; file scope extraction edge cases
- [ ] **Planner correctness:** pending scope, lane packing, dependency cycles, wave ordering bugs

### Step 2: Write AUDIT-REPORT.md

- [ ] Executive summary + cleanliness score /10
- [ ] Severity-rated findings (mandatory format)
- [ ] Regression check: Phase 13 issues that recurred or were incompletely fixed
- [ ] Top 10 refactor targets
- [ ] Recommended remediation tasks (`SP-1xx`)
- [ ] **Ready for next remediation wave? YES/NO**

### Step 3: Documentation & Delivery

- [ ] STATUS.md complete
- [ ] Create `.DONE`

## Completion Criteria

- [ ] AUDIT-REPORT.md with ≥5 substantive findings
- [ ] Phase 13 regression section present
- [ ] `.DONE` created

## Git Commit Convention

- `docs(SP-107): core architecture brutal audit report`

## Do NOT

- Modify production code
- Edit `.cursor/rules/**` (audit only)

---

## Amendments (Added During Execution)
