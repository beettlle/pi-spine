# SP-066: Supervisor v1 stub — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-03
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read operator runbook diagnose and journal sections
- [ ] Confirm no v1 supervisor agent spawn in codebase (grep `supervisor` in `src/batch/`)

---

### Step 1: Write v1 supervisor guidance
**Status:** ⬜ Not Started

- [ ] Replace `<!-- Customize supervisor instructions -->` with structured sections:
  - **v1 reality:** no supervisor Pi agent session; human operator + CLI/dashboard
  - **Operator tools:** `spine status --diagnose`, batch journal paths, dashboard URL/pattern
  - **Project overrides:** optional `.spine/agents/supervisor.md` for future use / notes (not auto-spawned in v1)
  - **Taskplane exclusion:** do not use Taskplane `/orch` alongside spine batch on same tasks root

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Template renders valid markdown (headings, no broken frontmatter)

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
| 2026-06-03 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
