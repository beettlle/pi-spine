# SP-594: v2.3.0 GitHub backlog hygiene — Status

**Current Step:** Step 1
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read handoff PRD and prior release manifest pattern
- [x] Dependencies satisfied

### Step 1: Execute
**Status:** 🔄 In Progress

- [ ] Complete deliverable per Mission
- [ ] Cross-check task table SP-574–595 in handoff §6

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] `spine tasks validate SP-594`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Handoff: `docs/PRD-v2.3.0-module-split-handoff.md` §5–§6, §8 (#117/#116 close)
- Prior pattern: SP-572 / SP-563 — `gh issue close` with SP-ID + landed SHA comment
- SP-593 `.DONE` present; `PHASE23_GRANDFATHERED_OVER_500 = []`; `tryRestoreBranch` in `integrate-git.mjs`

## Discoveries

| Finding | Action |
|---------|--------|
| Batch SHAs not yet on `origin/main` (orch/lane local until integrate push) | Cite full SHAs in close comments; GitHub commit permalinks resolve after orch→main push |
| Open issues baseline at Step 0 | 15 open (includes #116, #117) |

## Landed SHAs (SP-578–593)

| Task | Closing SHA | Subject |
|------|-------------|---------|
| SP-578 | `32d5f63572af9845f4393c1695a492495d533c04` | batch worker completion |
| SP-579 | `c8f0c4ef411fde164c4c7a77fa441fa45e13c206` | batch worker completion |
| SP-580 | `208276019f591addf88e9b6127baec44c28eeadd` | batch worker completion |
| SP-581 | `d3aa9a753308bba61d1042e3fd5ccd043bded41d` | batch worker completion |
| SP-582 | `cc31391e281f74a9dcf9f746169272c574881e36` | batch worker completion |
| SP-583 | `8680a5d3ad38d1367a034ea108df0f737f570307` | batch worker completion |
| SP-584 | `65206e631269485d42f4e096940e3d3841bfde45` | batch worker completion |
| SP-585 | `a07cbd6bb9b10f5138c96417aba46082cdfb81bb` | batch worker completion |
| SP-586 | `0081bf9cab2186a6df9628e47ad14851d085ba04` | batch worker completion |
| SP-587 | `671bcdb5c300f44c9cd8d2145a3c0f2c3017f5fb` | batch worker completion |
| SP-588 | `77068e46fbc3098eaafcc4fd59ddb0beb9cc2e0c` | batch worker completion |
| SP-589 | `498ea20995b171f11e1d47c21cb280b5efb04fc7` | refactor: split integrate.mjs (`tryRestoreBranch`) |
| SP-590 | `ab5c6ad9df3155453158bd30965d6a5ac6fa046f` | batch worker completion |
| SP-591 | `0b8d8ae2d27bef9ae6457719e24f3cf617dd16dc` | batch worker completion |
| SP-592 | `0f1222e0f1df176d5782ed5e95f3f01dbb764f44` | batch worker completion |
| SP-593 | `b368b4298ecb6c75271b244a837b676ee51bc2d3` | empty `PHASE23_GRANDFATHERED_OVER_500` |
