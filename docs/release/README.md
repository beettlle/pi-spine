# Release documentation

Operator guides for pi-spine semver releases, publish gates, and harness execution.

## Index

| Document | Purpose |
|----------|---------|
| [`manifest-v1.10.0-example.md`](manifest-v1.10.0-example.md) | Release sequence manifest **format reference** and filled v1.10.0 harness example (FR-STA-25) |
| [`npm-publish.md`](npm-publish.md) | npm publish workflow and post-publish smoke |
| [`v1.0-checklist.md`](v1.0-checklist.md) | v1.0 release checklist (historical) |
| [`stabilization-roadmap-v1.8-v2.0.md`](stabilization-roadmap-v1.8-v2.0.md) | Stabilization roadmap v1.8 → v2.0 |
| [`../adoption/component-maturity-matrix.md`](../adoption/component-maturity-matrix.md) | L0–L4 component maturity audit (tests, CI, cross-axis) — [#129](https://github.com/beettlle/pi-spine/issues/129) |

## Related

| Location | Purpose |
|----------|---------|
| [`skills/spine-release-operator/`](../../skills/spine-release-operator/) | Release operator skill (Phases 1–6) |
| [`skills/spine-release-operator/references/release-manifest-template.md`](../../skills/spine-release-operator/references/release-manifest-template.md) | Blank manifest template for new releases |
| [`spine-tasks/_authoring/release-v*/manifest.md`](../../spine-tasks/_authoring/) | Operator-approved scope per target version |

## Quick start (sequence runner)

```bash
# 1. Compose and approve manifest under spine-tasks/_authoring/release-v{TARGET}/
# 2. Extract release scope ID from manifest
spine preflight
spine run sequence <release-scope-id> --dry-run
spine run sequence <release-scope-id>   # detached; operator approves gates
```

See [`manifest-v1.10.0-example.md`](manifest-v1.10.0-example.md) for field definitions, regression gate, and operator gates.
