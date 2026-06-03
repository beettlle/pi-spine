# TP-021: Integrate gate FSM + evidence — Status

**Status:** Complete | **Last Updated:** 2026-06-01 | **Review Level:** 2 | **Size:** L

## Steps

### Step 0: Preflight
- [x] §12 read; TP-016 stub behavior on `main`

### Step 1: Gate FSM + persistence
- [x] `gate.mjs` — pending → approved | rejected; `.spine/runtime/{batchId}/gate.json`
- [x] Journal: `gate.opened`, `gate.approved`, `gate.rejected`

### Step 2: Evidence collection on batch complete
- [x] `evidence.mjs` — summary.md, diff-stat.txt, optional test/build output
- [x] `openIntegrateGateAfterBatchComplete` in engine + resume

### Step 3: spine gate CLI + integrate enforcement
- [x] `bin/spine-gate.mjs`, `spine gate` in spine.mjs
- [x] `/spine-gate` slash command
- [x] `checkIntegrateGate` replaces stub; exit 2 when blocked; `--force-integrate` + `SPINE_ALLOW_FORCE=1`

### Step 4: Tests + docs
- [x] `tests/batch/gate.test.mjs` + integrate/lifecycle updates
- [x] README gate workflow
- [x] npm test: 124 pass

## Completion Criteria

- [x] Integrate fails until gate approved; evidence dir populated
- [x] Tests pass (**124**)
