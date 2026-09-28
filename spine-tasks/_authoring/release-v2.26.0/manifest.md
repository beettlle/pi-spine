# Release manifest — v2.26.0

**Created:** 2026-09-27
**Current version:** 2.25.0
**Target version:** v2.26.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** no
**Worker model pin:** `zai/glm-5.3` via `agents.activeProfile=hard` (config commit `d138142c`) — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none

---

## Pre-authoring notes

Seeded before Phase 1 intake so the worker pin is decided before any v2.26 batch starts. Phase 2 fills in the remaining template sections; scope is not approved.

- **Why GLM-5.3 for this release:** the planned v2.26 work is the batch-state lock, compare-and-swap and journal fixes from epic [#324](https://github.com/beettlle/pi-spine/issues/324) (#301 with #293, #302, then the remaining P1s). The escalation profile `hard` now uses `zai/glm-5.3`, reviewed by `google/gemini-3.1-pro-preview` for plan, code and final review.
- **Escalation during this release:** none available — `escalatePolicy.toProfile` is `hard`, which is already active. Escalate only on content or contract failure, and record any override above before applying it.
- **v2.27 authoring:** switch back with `spine settings set agents.activeProfile default` before the first v2.27 batch, and record the default-profile worker pin (`zai/glm-5.3-flash`) in the v2.27 manifest.
