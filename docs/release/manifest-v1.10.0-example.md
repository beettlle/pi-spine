# Release sequence manifest — format and v1.10.0 example

Operators use a **release sequence manifest** to plan and execute semver-scoped spine releases. The manifest records composition, wave order, regression gates, and human-only approval points. Copy [`skills/spine-release-operator/references/release-manifest-template.md`](../../skills/spine-release-operator/references/release-manifest-template.md) for a new release, then fill from the PRD or authoring manifest.

**Sequence runner:** `spine run sequence` accepts the **release scope ID** (comma-separated SP-IDs from the manifest), not a manifest file path. The manifest is the operator contract; the scope ID is what the CLI executes.

**Source PRD:** [`docs/PRD-v1.10.0-release-harness-handoff.md`](../PRD-v1.10.0-release-harness-handoff.md) (FR-STA-25)

**Authoring copy:** [`spine-tasks/_authoring/release-v1.10.0/manifest.md`](../../spine-tasks/_authoring/release-v1.10.0/manifest.md)

---

## Manifest format (reference)

| Field | Required | Description |
|-------|----------|-------------|
| **Release scope ID** | Yes | Comma-separated SP-IDs passed to `spine plan`, `spine batch start`, and `spine run sequence <scope>`. No spaces. |
| **Waves** | Yes | Planner wave order from `spine plan <scope>`. Each wave is one `spine batch start --wave N` cycle. Parallel tasks within a wave share the same wave index. |
| **Regression gate** | Yes | Shell command run after each integrate (before next wave). Must match CI parity. v1.10.0 harness: `npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run release:check`. |
| **Operator gates** | Yes | Human-only steps the sequence runner does not auto-approve: scope manifest approval, `spine gate approve` per integrate wave, publish approval before `npm version`. |
| **Proof gate** | Recommended | Pre-publish dry-run criteria (e.g. 5-task patch release with operator touching only gate approve + publish approval; no `npm publish` during proof). |
| **Bump / profile** | Yes | Target version, bump type (`patch` \| `minor` \| `major`), and profile audit per [`release-profiles.md`](../../skills/spine-release-operator/references/release-profiles.md). |

### Sequence runner invocation

```bash
# Validate packets and confirm planner waves
spine tasks validate SP-530 SP-531 SP-532 SP-533 SP-534 SP-535 SP-536 SP-538 SP-537
spine plan SP-530,SP-531,SP-532,SP-533,SP-534,SP-535,SP-536,SP-538,SP-537

# Dry-run land loop (no batches started)
spine run sequence SP-530,SP-531,SP-532,SP-533,SP-534,SP-535,SP-536,SP-538,SP-537 --dry-run

# Execute (detached — omit --attached from agent shells; see #163)
spine run sequence SP-530,SP-531,SP-532,SP-533,SP-534,SP-535,SP-536,SP-538,SP-537

# Stub-only auto-approve (real pi requires --force; see SP-390 / sequence-safety doctor)
SPINE_WORKER_STUB=1 spine run sequence <scope> --auto-approve-gate --dry-run
```

Per-wave manual land loop (when not using full sequence):

```bash
spine batch start <scope> --wave N    # detached
spine status --diagnose
spine gate approve && spine integrate && npm install && spine batch complete
# run regression gate before next wave
```

---

## v1.10.0 example (filled)

**Created:** 2026-07-07  
**Current version:** 1.9.0  
**Target version:** v1.10.0  
**Bump type:** minor  
**Profile:** minor (harness epic — operator override for 9 tasks)

### Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 3 | 2–4 | PASS |
| Bug fixes | 4 | 3–5 | PASS |
| Enhancements | 2 | 1–2 | PASS |
| **Total tasks** | 9 | 10–15 | PASS (operator override — harness-focused) |

**Prerequisites (landed, not in release scope):** SP-350, SP-351, SP-360, SP-362, SP-388, SP-389, SP-391, SP-392

### Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-530 | #175 | doc | S | release:check skill gate | Closes |
| SP-531 | #156 | doc | S | tag CI gate | Closes |
| SP-532 | #173 | bug | S | complete waits engine | Closes |
| SP-533 | #167 | bug | S | concurrent resume failfast | Closes |
| SP-534 | #185 | doc | S | detached policy docs | Closes |
| SP-535 | #54 | doc | S | release manifest format | Partial |
| SP-536 | #54 | enh | S | sequence release profile | Partial |
| SP-538 | #188 | bug | S | review retry crash_recovered | Closes |
| SP-537 | — | doc | S | CONTEXT Phase 61 capstone | — |

### Release scope ID

```text
SP-530,SP-531,SP-532,SP-533,SP-534,SP-535,SP-536,SP-538,SP-537
```

### Wave plan

| Wave | Tasks | Parallel |
|------|-------|----------|
| H0 | SP-530, SP-532, SP-533, SP-538 | Yes |
| H1 | SP-531 | No (dep SP-530) |
| H2 | SP-535 | No |
| H3 | SP-536 | No (deps SP-535, SP-388) |
| H4 | SP-534 | No (after SP-530) |
| H5 | SP-537 | No (capstone) |

```text
Wave H0 parallel: SP-530, SP-532, SP-533, SP-538
Wave H1: SP-531
Wave H2: SP-535
Wave H3: SP-536
Wave H4: SP-534
Wave H5: SP-537
```

Run `spine plan SP-530,SP-531,SP-532,SP-533,SP-534,SP-535,SP-536,SP-538,SP-537` after validate for authoritative waves.

### Regression gate (per wave integrate)

```bash
npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run release:check
```

### Proof gate (pre-publish)

5-task patch release dry-run: operator touches only `spine gate approve` and publish approval. No `npm publish` during proof. Full v1.10.0 harness proof uses the scope above with regression gate green after each wave.

### Operator gates (human only)

1. Approve release scope manifest (`spine-tasks/_authoring/release-v1.10.0/manifest.md`)
2. `spine gate approve` per integrate wave
3. Publish approval before `npm version minor`

### Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #145–#150 | doc | skill template polish — defer |
| #163 | bug | attached orphan — partial via SP-534 |
| #120–#123, #117 | epic | v2.0.0 |

### Risks

- SP-531 and SP-534 both touch release-operator skill — may serialize after SP-530
- SP-536 depends on landed SP-388 sequence chain
- Proof dry-run required before publish (no npm publish in proof)

### Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] `spine preflight` green
- [ ] `npm run release:check` green
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per [`npm-publish.md`](npm-publish.md)
