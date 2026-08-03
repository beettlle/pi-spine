# SP-693: Post-publish smoke ETARGET retry — Status

**Current Step:** Step 1 — Docs + retry script
**Status:** 🔄 In Progress
**Last Updated:** 2026-08-03
**Review Level:** 1
**Review Counter:** 1
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm smoke docs lack retry — grep for `ETARGET`/`No matching version` in `docs/release/npm-publish.md` and `skills/spine-release-operator/SKILL.md`: no matches
- [x] Confirm SP-691 present — commit `16b35f93` landed; hard rules + model pin visible in SKILL.md

### Step 1: Docs + retry script
**Status:** 🔄 In Progress
- [ ] npm-publish.md retry/backoff
- [ ] Skill Phase 6 smoke update
- [ ] post-publish-smoke.sh with bounded retries
- [ ] chmod +x

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] bash -n contract
- [ ] Fix syntax issues

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Plan review checkpoint returned `skipped` (real-pi session; engine reviews after `.DONE`) | Proceeded with implementation per SP-195 |
| Post-mortem F9: first `npm install -g` failed seconds after release.yml success; retry succeeded | Retry wrapper classifies only ETARGET/E404/"No matching version" as lag; all other install errors fail closed immediately |

## Completion Criteria

- [ ] Docs specify retry
- [ ] Script bounded retries
- [ ] Exhausted retries fail closed
- [ ] Phase 6 skill updated

## Blockers

_None._
