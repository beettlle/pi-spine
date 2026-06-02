# Local install (pre-publish)

Use pi-spine from a **git checkout or local path** on a real project before `npm publish` or a pi.dev listing. This is the supported adoption path for Phase 9 pilots (see [real-project-readiness.md](./real-project-readiness.md)).

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| Node.js ≥ 22 | Same as [README](../../README.md#prerequisites) |
| [pi](https://pi.dev) | For slash commands and real workers |
| Git | Worktrees and batch orchestration |

## 1. Clone pi-spine

```bash
git clone https://github.com/beettlle/pi-spine.git
cd pi-spine
npm ci   # optional; needed for typecheck/tests in the spine repo
```

Keep the checkout path stable (for example `~/src/pi-spine`). Consumer projects will reference it.

## 2. Install into pi (recommended for slash commands)

From the **pi-spine checkout**:

```bash
pi install . -l
```

`-l` installs the package **project-locally** into the current pi project's package store (under `.pi/`). Run this from the repo you are developing in, or from each consumer repo that should load the extension.

Verify in pi:

```text
/spine-help   # or pi list — package pi-spine should appear
```

Slash commands (`/spine`, `/spine-plan`, …) come from the pi extension; they require a successful `pi install`, not only a global `spine` binary.

## 3. Global `spine` CLI (optional)

For terminal use outside pi:

```bash
cd /path/to/pi-spine
npm link
```

This links `bin/spine.mjs` onto your PATH as `spine`. After you pull new commits, re-run `npm link` from the checkout (or use `node bin/spine.mjs` directly).

**Consumer `package.json` (monorepo / file dependency):**

```json
{
  "dependencies": {
    "pi-spine": "file:../pi-spine"
  }
}
```

Then from the consumer repo:

```bash
npm install
npx spine version
npx spine doctor
```

`npx spine` always uses the linked file dependency; it does not depend on a stale global binary.

## 4. Bootstrap a consumer project

In your application repo (not the pi-spine repo):

```bash
# If pi-spine is not already installed for this project:
pi install /absolute/path/to/pi-spine -l

spine init --tasks-root taskplane-tasks --preset taskplane-compat
spine doctor
spine migrate-from-taskplane --dry-run --source .pi/taskplane-config.json   # Taskplane migrants
spine plan pending
spine preflight
```

Doctor should pass or show **clear warnings** (for example stale global `spine` on PATH — see below).

## 5. Verify slash commands

1. Open pi in the consumer repo.
2. Confirm `pi-spine` is listed (`pi list` or package UI).
3. Run `/spine-plan pending` (preview only) or `/spine-status`.
4. For a stub batch: `SPINE_WORKER_STUB=1 spine batch start <task-id> --dry-run`.

Stub workers are documented in the README; use `SPINE_WORKER_STUB=0` only when you are ready for real `pi -p` workers.

## Troubleshooting

### `spine: command not found` (empty PATH)

Symptoms: shell cannot find `spine`; `which spine` prints nothing.

Fixes (pick one):

| Approach | Command |
|----------|---------|
| npm link (global CLI) | `cd /path/to/pi-spine && npm link` |
| Direct node | `node /path/to/pi-spine/bin/spine.mjs doctor` |
| npx from file dep | `npx spine doctor` (after `"pi-spine": "file:…"` in package.json) |
| pi only | Use slash commands; CLI optional |

Doctor warns when `which spine` fails; that is advisory — pi slash commands can still work if `pi install … -l` succeeded.

### Stale global `spine`

Symptoms: `spine doctor` behaves like an old build; `which spine` points outside your current checkout; doctor shows **"spine on PATH (stale)"**.

Fix:

```bash
cd /path/to/pi-spine
npm link
# or reinstall pi package:
pi install /path/to/pi-spine -l
spine doctor
```

Prefer `node /path/to/pi-spine/bin/spine.mjs` when debugging until PATH is fixed.

### Slash commands missing

- Run `pi install /path/to/pi-spine -l` from the **consumer** repo.
- Restart pi after install.
- Confirm `package.json` in pi-spine has `"pi-package"` keyword and `pi.extensions` (shipped in the checkout).

### Taskplane and pi-spine together

Do **not** run Taskplane `/orch` and `spine batch start` on the same repo concurrently. See README "Migrating from Taskplane".

## Related docs

| Doc | Purpose |
|-----|---------|
| [real-project-readiness.md](./real-project-readiness.md) | Phase 9 adoption tiers and task map |
| [../release/v1.0-checklist.md](../release/v1.0-checklist.md) | Post-publish install (future) |
| [README](../../README.md) | Full CLI and batch reference |

