# SP-768: Wave C Actions majors — Status

**Current Step:** Complete
**Status:** ✅ All steps done
**Last Updated:** 2026-09-26
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Record current uses: pins
- [x] Confirm Waves A–B landed
- [x] Dependencies satisfied

### Step 1: Bump Actions majors
**Status:** ✅ Complete

- [x] checkout/setup-node → v7
- [x] upload-artifact → v7
- [x] github-script → v9
- [x] Preserve OIDC / gate semantics

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint
- [x] Run Contract testCommand
- [x] Fix failures

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged (docs deferred to SP-769)
- [x] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Pins recorded: ci.yml checkout@v4/setup-node@v4/upload-artifact@v4; release.yml checkout@v4/github-script@v7/setup-node@v4; real-pi.yml checkout@v4/setup-node@v4 | Bump all to checkout/setup-node v7, upload-artifact v7, github-script v9 |
| Waves A–B landed: TS 6.0.3, ESLint ^10.10.0, @earendil-works/pi-coding-agent ^0.87.0 | Wave C only; do not bump TS/types/pi peer |
| `scripts/verify-actions-wave-c.mjs` already exists in repo and matches Contract testCommand | Reuse as-is; no new script needed |
| `npm test` in worker session: 2608 pass / 43 fail — all 43 are `nested_batch_spawn_blocked` (SP-482 worker guard); same batch suites pass 1500/1500 with worker env vars unset | Environmental, not caused by this change |
| gitnexus detect_changes: 0 changed symbols, 0 affected processes, risk low | Pin-only change confirmed |

## Completion Criteria

- [x] Workflows on Actions v7 / github-script v9
- [x] Contract green
- [x] Partial #285

## Blockers

_None yet._
