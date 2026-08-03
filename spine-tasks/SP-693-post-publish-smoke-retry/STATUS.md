# SP-693: Post-publish smoke ETARGET retry — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** ✅ Complete
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
**Status:** ✅ Complete
- [x] npm-publish.md retry/backoff — step 5 rewritten with bounded backoff guidance + checklist line updated
- [x] Skill Phase 6 smoke update — references `scripts/post-publish-smoke.sh` and fail-closed policy
- [x] post-publish-smoke.sh with bounded retries — retries only ETARGET/E404/"No matching version"/404-class errors; non-lag errors exit 1 immediately; exhausted retries exit 1 with missing-version guidance
- [x] chmod +x — mode 100755 committed

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] bash -n contract — `bash -n scripts/post-publish-smoke.sh` → syntax OK
- [x] Fix syntax issues — none; usage guard verified (`exit=2` on missing/invalid args)

### Step 3: Documentation & Delivery
**Status:** ✅ Complete
- [x] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Plan review checkpoint returned `skipped` (real-pi session; engine reviews after `.DONE`) | Proceeded with implementation per SP-195 |
| Post-mortem F9: first `npm install -g` failed seconds after release.yml success; retry succeeded | Retry wrapper classifies only ETARGET/E404/"No matching version" as lag; all other install errors fail closed immediately |
| `spine version` output format unknown to worker | Script accepts `v`-prefixed input and greps installed output for the requested version string; mismatch exits 1 |

## Completion Criteria

- [x] Docs specify retry — npm-publish.md step 5 + pre-publish checklist
- [x] Script bounded retries — max 6 attempts default, 5s→60s capped backoff
- [x] Exhausted retries fail closed — exit 1 with "real missing-version failure" message
- [x] Phase 6 skill updated — references retry policy/script

## Blockers

_None._
