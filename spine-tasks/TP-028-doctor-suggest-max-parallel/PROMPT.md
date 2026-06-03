# Task: TP-028 — Doctor suggests lanes.maxParallel

**Created:** 2026-06-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Small advisory check in existing doctor flow; pure heuristic module + tests. No batch engine or config auto-mutation.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Canonical Task Folder

```
taskplane-tasks/TP-028-doctor-suggest-max-parallel/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Operators see three dashboard lanes because `lanes.maxParallel` defaults to **3**, but nothing explains *why* or whether that fits their machine. Add an **informational** `spine doctor` check that **suggests** a reasonable `lanes.maxParallel` value.

**Important:** Lanes are git worktrees + LLM workers, not CPU threads. The heuristic must **not** recommend one lane per physical core. Use a conservative cap tied to typical solo-operator capacity (API cost, supervision, merge risk).

## Dependencies

- **None**

## Context to Read First

**Tier 2:**
- `taskplane-tasks/CONTEXT.md`

**Tier 3:**
- `bin/spine.mjs` — `runDoctorChecks`, `cmdDoctor` (warning vs fail patterns)
- `templates/spine-config.json` — `lanes.maxParallel` default
- `docs/PRD.md` — FR-INIT-06, FR-SCHED-04, §7.3 lane assignment

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/doctor/suggest-max-parallel.mjs` (new)
- `bin/spine.mjs`
- `tests/doctor/suggest-max-parallel.test.mjs` (new)
- `README.md` (doctor section — one paragraph)

## Steps

### Step 0: Preflight

- [ ] Read `runDoctorChecks`; confirm warnings do not increment `issueCount`
- [ ] Note current config: `lanes.maxParallel` in `.spine/spine-config.json`

### Step 1: Heuristic module

- [ ] Add `src/doctor/suggest-max-parallel.mjs` exporting:
  - `detectCpuCount()` — `os.availableParallelism?.() ?? os.cpus().length` (test may inject count)
  - `suggestMaxParallel(cpuCount)` — returns `{ suggested, rationale }`
- [ ] **Normative heuristic (v1):**
  - `suggested = clamp(1, 4, floor(cpuCount / 2))` using integer math
  - Rationale string explains: lanes = parallel **agents/worktrees**, not CPU threads; cap avoids API/supervision overload
  - Document in code comment: do **not** use `cpuCount` as `maxParallel`
- [ ] Export `buildMaxParallelDoctorCheck({ configured, cpuCount })` returning a doctor check object compatible with `runDoctorChecks` (`label`, `ok: true`, optional `warning`, `detail`, `suggestedCommand`)

**Artifacts:**
- `src/doctor/suggest-max-parallel.mjs` (new)

### Step 2: Wire into spine doctor

- [ ] In `runDoctorChecks`, after config is valid, read `config.lanes?.maxParallel` (default **3** if missing)
- [ ] Append informational check, e.g. label `lanes.maxParallel sizing`
- [ ] Behavior:
  - `ok: true` always (never fail doctor)
  - `warning: true` when `configured > suggested + 1` (operator likely over-parallel)
  - `detail` shows `configured=N, suggested=M (K CPU threads)` and short rationale
  - `suggestedCommand` when warning: hint to edit `.spine/spine-config.json` (no auto-write)
  - When `configured <= suggested`, still show detail (informational, no warning)
- [ ] Keep `runDoctorChecks` export stable for preflight tests

**Artifacts:**
- `bin/spine.mjs` (modified)

### Step 3: Tests & verification

- [ ] `tests/doctor/suggest-max-parallel.test.mjs`:
  - Table tests: cpu 4→2, 8→4, 1→1, 2→1
  - `buildMaxParallelDoctorCheck` warning when configured=3 and suggested=2 on 4-core (if applicable)
  - `buildMaxParallelDoctorCheck` no warning when configured matches suggested
- [ ] Optional: extend doctor integration smoke if one exists; otherwise unit tests suffice
- [ ] Full `npm test` + `npm run typecheck`

### Step 4: Documentation

- [ ] README: `spine doctor` includes `lanes.maxParallel` sizing suggestion
- [ ] CONTEXT.md: TP-028 Done when landed

## Documentation Requirements

**Must Update:**
- `README.md`
- `taskplane-tasks/CONTEXT.md`

**Check If Affected:**
- `docs/PRD.md` — only if adding FR-INIT note (optional; prefer README only for S task)

## Completion Criteria

- [ ] `spine doctor` prints configured vs suggested `maxParallel` with rationale
- [ ] Heuristic is conservative (not 1:1 with CPU count)
- [ ] New tests pass; full suite green
- [ ] Doctor still passes when suggestion differs (advisory only)

## Git Commit Convention

- `feat(TP-028): complete Step N — description`

## Do NOT

- Auto-modify `.spine/spine-config.json`
- Change planner/engine defaults (stay 3 in template unless explicitly justified)
- Fail doctor or preflight when configured > suggested

---

## Amendments (Added During Execution)
