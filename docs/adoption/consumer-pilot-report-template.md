# Consumer pilot sign-off — Tier 3

**Date:** YYYY-MM-DD  
**Operator:**  
**Consumer repo:** (path or URL)  
**pi-spine commit:**  
**pi version:**  

## Environment

| Check | Result |
|-------|--------|
| `spine doctor` | |
| `SPINE_WORKER_STUB` unset | |
| Pinned `SPINE_BIN` | |

## Batches run

| Batch ID | Scope | Mode | Outcome |
|----------|-------|------|---------|
| | 1–2 tasks stub | SPINE_WORKER_STUB=1 | |
| | 1 task real pi | attached | |

## Land loop

- [ ] `spine preflight`
- [ ] `spine batch start` / resume
- [ ] `spine status --diagnose`
- [ ] `spine gate approve`
- [ ] `spine integrate`
- [ ] `spine batch complete`

## Recovery exercised

- [ ] Orphan / retry path documented
- [ ] `spine handoff` used after session break

## Sign-off

**Verdict:** pass / fail with issues  
**Blockers for daily use:**
