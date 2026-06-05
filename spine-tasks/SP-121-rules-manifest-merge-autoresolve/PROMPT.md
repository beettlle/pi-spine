# Task: SP-121 — Auto-resolve rules-manifest merge conflicts

**Created:** 2026-06-05
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Stress batch required manual resolution of `.spine/rules-manifest.json` generatedAt conflicts on every lane→orch merge.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

When lane merge hits rules-manifest conflict with only `generatedAt` differing, auto-resolve by keeping newest timestamp (rules[] identical). Add merge driver or pre-merge normalization in engine merge path.

**Source:** Batch `20260605T191325` operator recovery (lanes 2–4).

## Dependencies

- **None**

## File Scope

- `src/batch/engine-lanes.mjs`
- `src/config/cursor-rules/discover.mjs`
- `tests/batch/rules-manifest-merge.test.mjs` (new)

## Steps

### Step 1: Conflict detection + auto-resolve
- [ ] Detect generatedAt-only manifest conflicts during lane merge
- [ ] Keep max(generatedAt); fail loud if rules[] differ

### Step 2: Testing & Verification
- [ ] FULL suite + coverage gate

### Step 3: Documentation & Delivery
- [ ] Operator runbook note under merge troubleshooting
- [ ] `.DONE`

## Completion Criteria
- [ ] Parallel lanes merging manifest-only timestamp drift do not block batch

## Git Commit Convention
- `fix(SP-121): auto-resolve rules-manifest generatedAt merge conflicts`

## Do NOT
- Silently merge differing rules[] arrays

---

## Amendments (Added During Execution)
