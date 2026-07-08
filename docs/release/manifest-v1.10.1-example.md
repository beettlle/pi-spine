# Release sequence manifest — v1.10.1 example

Operators use a **release sequence manifest** to plan and execute semver-scoped spine releases. Copy [`skills/spine-release-operator/references/release-manifest-template.md`](../../skills/spine-release-operator/references/release-manifest-template.md) for a new release, then fill from the PRD.

**Sequence runner:** `spine run sequence` accepts the **release scope ID** (comma-separated SP-IDs), not a manifest file path.

**Source PRD:** [`docs/PRD-v1.10.1-stabilization-handoff.md`](../PRD-v1.10.1-stabilization-handoff.md) (Phase 61b — SP-STAB)  
**CONTEXT tracking:** [`spine-tasks/CONTEXT.md`](../../spine-tasks/CONTEXT.md) (Phase 61b — SP-STAB)  
**Authoring manifest:** [`spine-tasks/_authoring/release-v1.10.1/manifest.md`](../../spine-tasks/_authoring/release-v1.10.1/manifest.md)

---

## v1.10.1 example (filled)

**Created:** 2026-07-08  
**Current version:** 1.10.0  
**Target version:** v1.10.1  
**Bump type:** patch  
**Profile:** patch (stabilization — 4 tasks)

### Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Bug fixes | 3 | 2–4 | PASS |
| Documentation | 1 | 1–2 | PASS |
| **Total tasks** | 4 | 4–6 | PASS |

### Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-539 | #163 | bug | M | attached parent-died guard | Closes |
| SP-540 | #187 | bug | S | validate npm test hardfail | Closes |
| SP-541 | #187 | bug | S | contract-verify npm guard | Hardening |
| SP-542 | — | doc | S | CONTEXT Phase 61b capstone | — |

### Release scope ID

```text
SP-539,SP-540,SP-541,SP-542
```

### Wave plan

| Wave | Tasks | Parallel |
|------|-------|----------|
| S0 | SP-539, SP-540 | Yes |
| S1 | SP-541 | No (dep SP-540) |
| Cap | SP-542 | No |

```text
Wave S0 parallel: SP-539, SP-540
Wave S1: SP-541
Cap: SP-542
```

Run `spine plan SP-539,SP-540,SP-541,SP-542` after validate for authoritative waves.

### Regression gate (per wave integrate)

```bash
npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run release:check
```

### Operator gates (human only)

1. Approve release scope manifest
2. `spine gate approve` per integrate wave
3. Publish approval before `npm version patch`
4. GitHub issue cleanup per PRD §11 (close #174, #173, #167, #188, #163, #187)

### GitHub cleanup (post-publish)

| Issue | Landed in | Close at |
|-------|-----------|----------|
| #174 | SP-528 (`1176e8b6`) | v1.10.1 publish |
| #173 | SP-532 (`fa2d1584`) | v1.10.1 publish |
| #167 | SP-533 (`c221bdc6`) | v1.10.1 publish |
| #188 | SP-538 (`bf7c89d0`) | v1.10.1 publish |
| #163 | SP-539 | After merge |
| #187 | SP-540/SP-541 | After merge |

### Risks

- SP-539 is Size M — parent PID monitor touches attached engine hot path; review blast radius before merge
- `.pi-smart-router/state.db-{shm,wal}` may block preflight git-clean — restore before batch/publish
- Detached batches only — do not use `--attached` from agent shells

### Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main` (SP-539, SP-540 landed; SP-541, SP-542 pending at capstone)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green
- [ ] `git status` clean
- [ ] Operator approved publish bump type: patch
- [ ] `npm version patch` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] GitHub issues closed per PRD §11
- [ ] Post-publish smoke per [`npm-publish.md`](npm-publish.md)
