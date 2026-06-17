# Local install (development)

Use pi-spine from a **git checkout or local path** when developing pi-spine itself or testing unreleased changes. For normal adoption, install from npm or pi.dev first (see [README](../../README.md#adoption)).

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

## 2. Install into pi (local path)

From your **target project** (the repo you are orchestrating):

```bash
cd /path/to/your-app
pi install /path/to/pi-spine -l
```

`-l` links the package for development (changes in the pi-spine checkout are visible after restart/reload as appropriate).

## 3. Verify

```bash
spine doctor
spine preflight
```

`spine doctor` should report the linked pi-spine path. If an older global `spine` is on `PATH`, doctor may warn — prefer the linked install or `npm install -g pi-spine@latest`.

## 4. Optional: global CLI from checkout

```bash
cd /path/to/pi-spine
npm link
```

Use when you want `spine` on PATH without going through pi's extension loading only.

## Related

- [bootstrap-checklist.md](./bootstrap-checklist.md) — first-time consumer setup
- [operator-runbook.md](./operator-runbook.md) — daily operator procedures
- [real-project-readiness.md](./real-project-readiness.md) — adoption plan
