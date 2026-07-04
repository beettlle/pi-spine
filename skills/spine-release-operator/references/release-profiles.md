# Release profiles (semver-driven scope)

Use at **Phase 2** after parsing the operator's target version. Compare `package.json` version to the target to derive bump type.

## Derive bump type

| Current → Target | Bump type | Profile |
|------------------|-----------|---------|
| `1.5.0` → `1.5.1` | **patch** | `patch` |
| `1.5.0` → `1.6.0` | **minor** | `minor` |
| `1.5.0` → `2.0.0` | **major** | `major` |

If the operator says only `patch` / `minor` / `major` without a version, compute the next version from `package.json` and record both in the manifest.

## Invocation parsing

| Operator says | Profile |
|---------------|---------|
| "release for v1.5.1", "patch release", "hotfix release" | `patch` |
| "release for v1.6.0", "minor release", "feature release" | `minor` |
| "release for v2.0.0", "major release", "breaking release" | `major` |
| "run a spine release cycle" (no version) | **Ask** operator for target version or bump type |

## Profile budgets

### Patch (`patch`)

Stability and correctness focus. Smallest release window.

| Bucket | Target | Hard limits |
|--------|--------|-------------|
| Documentation | 1–2 small fixes/clarifications | No new feature docs; defer large doc epics |
| Bug fixes | 3–5 | Primary focus; prefer S-sized |
| Enhancements | **0** | Defer all; warn if operator insists without override |
| Total tasks | **5–8** | Warn if >8 without override |
| Max waves | 1–2 | Prefer single wave when possible |
| Task sizes | **S only** | Split any M/L before inclusion |

**Defer by default:** all enhancements, M/L tasks, epics, roadmap items, skill authoring clusters unless trivial typo fixes.

### Minor (`minor`)

Balance new capability with stability.

| Bucket | Target | Hard limits |
|--------|--------|-------------|
| Documentation | 2–4 | Include docs for the chosen enhancement |
| Bug fixes | 3–5 | Same as patch |
| Enhancements | **1–2** | At most one M if split into safe waves |
| Total tasks | **10–15** | Warn if >15 without override |
| Max waves | 2–4 | ≤4 M-sized tasks per wave |
| Task sizes | S/M | Split L/XL before inclusion |

**Defer by default:** epics (#117 v2.3 module split), multi-enhancement batches, tasks requiring >4 waves.

### Major (`major`)

Breaking changes and large migrations. Operator-defined epic scope.

| Bucket | Target | Hard limits |
|--------|--------|-------------|
| Documentation | Migration guides + comprehensive pass | Required for breaking changes |
| Bug fixes | 3–5 critical | Prioritize regressions blocking migration |
| Enhancements | Multiple allowed | Breaking API changes OK with migration path |
| Total tasks | Operator-defined | Manifest must list explicit epic boundaries |
| Max waves | Planned in manifest | Expect multi-cycle execution |

**Require:** explicit operator approval of epic scope before Phase 3. Do not auto-select major scope from backlog alone.

## Selection order (all profiles)

Apply in this order; stop when profile budget is full:

1. **Documentation** — `label:documentation`, `skill:create-spine-tasks` doc issues, pending docs-only SP-* tasks
2. **Bug fixes** — open `label:bug` with user impact; prefer already-tasked or quick S
3. **Enhancements** — only if profile allows; one user-visible improvement per minor release

## Profile audit (must pass before Phase 3)

Fill the composition audit table in the manifest. Fail or warn when:

| Check | Patch | Minor | Major |
|-------|-------|-------|-------|
| Enhancement count | >0 without override | >2 without override | — |
| Bug count | <3 or >5 without override | <3 or >5 without override | <3 without override |
| Total tasks | >8 without override | >15 without override | — |
| M/L tasks in patch | any without override | — | — |
| Doc paths in File Scope | required for doc tasks (#144) | required | required |

Record `Profile audit: PASS` or `PASS with operator override` before proceeding.

## Version ↔ publish alignment

The bump type chosen in Phase 2 must match `npm version` in Phase 6:

- `patch` profile → `npm version patch`
- `minor` profile → `npm version minor`
- `major` profile → `npm version major`

If the operator changes bump type at publish gate, update the manifest and confirm scope still fits the new profile.
