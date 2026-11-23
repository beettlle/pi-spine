# SP-892: Extract issues github provider — Status

**Current Step:** Step 1: Extract provider
**Status:** 🟡 Step 1 in progress
**Last Updated:** 2026-11-23
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Dependencies satisfied (SP-891) — `src/integrations/issues/mission-issue-links.mjs` landed (commit 85c9da05); `defaultRunGh` (sync-on-land.mjs:76–95), `GH_CALL_TIMEOUT_MS` (line 24), `GhRunResult` typedef (lines 39–44) identified as extract surface
- [x] Identify extract surface

---

### Step 1: Extract provider
**Status:** ✅ Complete

- [x] Create providers/github.mjs — exports `defaultRunGh` (spawn options: cwd/encoding/stdio/timeout identical to original; result shape `{ status, stdout, stderr, error }`), `GH_CALL_TIMEOUT_MS`, `GhRunResult` typedef; optional `{ spawn }` injection seam for deterministic tests (repo pattern: `tests/doctor/inherit-provider-auth.test.mjs` `spawnFn`)
- [x] Rewire sync-on-land — removed inlined `spawnSync` import, `GH_CALL_TIMEOUT_MS`, local typedef, and `defaultRunGh`; imports provider; call-site arrow wrapper unchanged; `GhRunResult` re-declared via `import()` type

---

### Step 2: Testing & Verification
**Status:** ⚪ Pending

- [ ] Provider + sync tests
- [ ] Contract testCommand

---

### Step 3: Documentation & Delivery
**Status:** ⚪ Pending

- [ ] Discoveries logged
- [ ] Create `.DONE`

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
| 2026-11-23 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

Release v2.35.0 — Partial #387 (provider extract).

**2026-11-23 prelanded amend:** `sync-on-land.mjs` removed from `fileScopeMustChange` (already on main via SP-890/SP-891); still in File Scope for extract rewire.
