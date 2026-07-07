# Task: SP-535 — Harness release manifest format

**Created:** 2026-07-07
**Size:** S

## Review Level: 0 (None)

**Assessment:** Documentation for release sequence manifest format and v1.10.0 example.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Implement FR-STA-25 (partial): document the **release sequence manifest** format and ship a filled v1.10.0 example ([#54](https://github.com/beettlle/pi-spine/issues/54) Partial). Operators use this with `spine run sequence <manifest>` for release-scoped waves.

**Partial:** [#54](https://github.com/beettlle/pi-spine/issues/54)

## Dependencies

- **None**

## Context to Read First

- [`docs/PRD-v1.10.0-release-harness-handoff.md`](../../docs/PRD-v1.10.0-release-harness-handoff.md) §FR-STA-25, §12
- [`skills/spine-release-operator/references/release-manifest-template.md`](../../skills/spine-release-operator/references/release-manifest-template.md)
- [`spine-tasks/_authoring/release-v1.9.0/manifest.md`](../../spine-tasks/_authoring/release-v1.9.0/manifest.md)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/release/manifest-v1.10.0-example.md`
- `docs/release/README.md`
- `skills/spine-release-operator/references/release-manifest-template.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/release/manifest-v1.10.0-example.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Read release-manifest-template and v1.9.0 manifest example
- [ ] List SP-530–538 release scope from authoring manifest

### Step 1: Manifest format doc

- [ ] Create `docs/release/manifest-v1.10.0-example.md` with wave plan, scope ID, proof gate notes
- [ ] Document manifest fields: scope ID, waves, regression gate, operator gates

### Step 2: Cross-links

- [ ] Update `docs/release/README.md` index entry for manifest example
- [ ] Align release-manifest-template with sequence runner invocation if gaps found

### Step 3: Testing & Verification

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] `docs/release/manifest-v1.10.0-example.md` exists and matches SP-530–538 scope
- [ ] Manifest format documented for `spine run sequence`

## Do NOT

- Implement sequence runner code changes (SP-536)
- Author SP-537 CONTEXT updates

## Git Commit Convention

- `docs(SP-535): release sequence manifest format and v1.10.0 example`
