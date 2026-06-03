# Task: SP-079 — Split spine.mjs CLI router

**Created:** 2026-06-03
**Size:** M

## Review Level: 1 (Plan Only)

**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1

## Mission

Strangler split `bin/spine.mjs` (732 lines): extract subcommand dispatch to focused modules (batch, plan, status, gate, integrate). Dedupe shared CLI output helpers with get-version.mjs patterns.

## Dependencies

- **None** (optional after SP-074; disjoint scope)

## File Scope

- `bin/spine.mjs`
- `bin/spine-cli/*.mjs` (new)
- `bin/get-version.mjs`
- `tests/cli/spine-router.test.mjs` (new)

## Steps

### Step 1: Extract dispatch modules
> **Plan-review checkpoint**
- [ ] One module per command group; spine.mjs becomes thin router

### Step 2: Tests + get-version
- [ ] CLI smoke tests unchanged; remove shell:true if present

### Step 3: Testing & Verification
- [ ] FULL suite; coverage ≥77%

---

## Amendments (Added During Execution)
