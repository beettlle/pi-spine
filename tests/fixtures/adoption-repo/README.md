# Adoption consumer fixture

Minimal git-backed consumer project layout for pi-spine adoption smoke tests and operator drills.

**Purpose:** Exercise init → plan → stub batch → `.DONE` without touching a production repository. Copied to a temp directory by `tests/adoption/fixture-batch.test.mjs` and `scripts/adoption-smoke.sh`.

**Layout:**

| Path | Role |
|------|------|
| `taskplane-tasks/AD-001-smoke/` | Review Level 0 smoke task (touch `DONE.txt`) |
| `taskplane-tasks/dependencies.json` | Empty dependency graph |

Spine config (`.spine/spine-config.json`) is **not** checked in — bootstrap runs `spine init --preset taskplane-compat` on first use. See [bootstrap-checklist.md](../../../docs/adoption/bootstrap-checklist.md).
