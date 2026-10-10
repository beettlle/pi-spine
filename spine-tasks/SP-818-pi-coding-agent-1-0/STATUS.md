# SP-818: Bump pi-coding-agent dev pin to ^1.0.1 — Status

**Current Step:** Step 1: Bump + fix-ups
**Status:** 🟡 In Progress
**Last Updated:** 2026-10-10
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] SP-817 landed
- [x] Dependencies satisfied

### Step 1: Bump + fix-ups
**Status:** ✅ Complete

- [x] Dev pin + lockfile
- [x] Fix-ups (or none)
- [x] minPiVersion decision

### Step 2: Docs
**Status:** 🟡 In Progress

- [ ] Four doc pins

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Audit 0 high
- [ ] Full suite
- [ ] Coverage gate
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | Preflight: lane-1 was behind orch (SP-817 landed on lane-3, merged to orch at `94101263`). Fast-forwarded lane-1 to orch before starting — `package.json`/`package-lock.json` conflict required the picomatch base. |
| 2 | `npm install -D @earendil-works/pi-coding-agent@^1.0.1` re-saved the spec as `^1.1.0` (npm saves installed version with caret prefix). Reset spec to `^1.0.1` per contract via `npm pkg set`; lockfile resolves to **1.1.0** (published 2026-10-07, satisfies `^1.0.1`; 1.0.1 is no longer latest). Typecheck + 37/37 extension/agent tests green against 1.1.0. |
| 3 | **Fix-ups: none needed.** `npm run typecheck` (both tsconfigs) green on first run against 1.1.0; scanned 1.0.0/1.0.1/1.1.0 changelogs — no removed/renamed symbols among our imports (`defineTool`, `AgentToolResult`, `ExtensionAPI`, `ExtensionCommandContext`, `createAgentSession`). 1.0.0 changes are additive for extension tool APIs (exposure, namespace, annotations). |
| 4 | **minPiVersion decision: stays `0.80.0`.** 1.0.1/1.1.0 changelogs state no pi CLI runtime floor; package `engines` is node-only (`>=22.19.0`, already matches our `engines.node`). No `peerDependencies` in the package. Workflow pi stubs unchanged. |
## Blockers

_None._
