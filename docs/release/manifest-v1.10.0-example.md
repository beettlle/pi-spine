# Release sequence manifest — v1.10.0 example

Example manifest for `spine run sequence` driving the v1.10.0 release harness scope.

**Source PRD:** [`docs/PRD-v1.10.0-release-harness-handoff.md`](../PRD-v1.10.0-release-harness-handoff.md)

---

## Scope

**Release scope ID:**

```text
SP-530,SP-531,SP-532,SP-533,SP-534,SP-535,SP-536,SP-538,SP-537
```

**Bump:** minor (1.9.0 → 1.10.0)

---

## Wave plan

| Wave | Tasks | Parallel |
|------|-------|----------|
| H0 | SP-530, SP-532, SP-533, SP-538 | Yes |
| H1 | SP-531 | No (dep SP-530) |
| H2 | SP-535 | No |
| H3 | SP-536 | No (deps SP-535, SP-388) |
| H4 | SP-534 | No (after SP-530) |
| H5 | SP-537 | No (capstone) |

---

## Operator commands

```bash
# Dry-run wave plan (after SP-536)
spine run sequence SP-530,SP-531,SP-532,SP-533,SP-534,SP-535,SP-536,SP-538,SP-537 --dry-run

# Execute wave by wave (detached — no --attached from agent shell)
spine batch start SP-530,SP-532,SP-533,SP-538 --wave 0
spine status --diagnose
spine gate approve && spine integrate && npm install && spine batch complete
# repeat for waves H1–H5
```

---

## Regression gate (per wave integrate)

```bash
npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run release:check
```

---

## Proof gate (pre-publish)

5-task patch release dry-run: operator touches only `spine gate approve` + publish approval. No `npm publish` during proof.

---

## Operator gates (human only)

1. Approve release scope manifest (`spine-tasks/_authoring/release-v1.10.0/manifest.md`)
2. `spine gate approve` per integrate wave
3. Publish approval before `npm version minor`

---

## Publish

```bash
npm run release:check
npm version minor    # operator approval required
git push && git push --tags
gh run watch --workflow release.yml
npm install -g pi-spine@1.10.0 && spine doctor
pi install npm:pi-spine
```
