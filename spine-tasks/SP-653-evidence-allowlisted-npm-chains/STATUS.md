# SP-653: Evidence allowlisted npm chains — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-13
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Document current metacharacter rejection rules
- [x] Define allowlist + &&-only chain grammar

### Step 1: Implement allowlisted `&&` chains
**Status:** ✅ Complete
- [x] Parse/validate multi-segment allowlisted commands
- [x] Execute segments sequentially fail-closed
- [x] Keep scripts/ Phase A path working
- [x] Reject other metacharacters / expansions

### Step 2: Testing & Verification
**Status:** 🟡 In Progress
- [x] Add evidence-allowlisted-chains.test.mjs
- [ ] Extend evidence.test.mjs if needed
- [x] Run contract testCommand
- [x] Fix scoped failures
- [ ] Coverage gate (≥77%)

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`
- [ ] Comment on #160 Phase B; leave open for Phase C

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Template already has `npm run typecheck && npm test` | Leave template unchanged; evidence now accepts Phase B chains |
| `SHELL_METACHAR_PATTERN` matches `&` so `&&` is rejected today | Strip `&&` before metachar scan; still reject lone `&` |
| GitNexus impact on assert/parse/run: LOW | Proceeded with edits |
| Real-pi worker (`SPINE_WORKER_RUNNER` set) | Engine reviews after `.DONE`; in-worker plan review returns skipped |
| Existing evidence.test.mjs still covers Phase A + metachar rejects | No extend required beyond new allowlisted-chains file |

## Completion Criteria

- [x] Allowlisted && chains execute
- [x] Other metacharacters rejected
- [x] Phase A scripts/ unchanged
- [ ] #160 remains open with Phase B note

## Blockers

_None._

## Step 0 Notes — Current rejection rules (pre-Phase B)

`assertSafeEvidenceCommand` today:

1. Non-empty string, no `\r`/`\n`
2. `SHELL_METACHAR_PATTERN = /[;|&\`<>]|>>|\$\(|\$\{/` — rejects `;`, `|`, `&`, backticks, `<`, `>`, `>>`, `$(`, `${`
3. Any `$` → variable-expansion rejection
4. First token must be: allowlisted basename (`npm`/`node`/`npx`/`pnpm`/`yarn`), or `.venv`/`venv` python, or `scripts/` relative path

## Step 0 Notes — Phase B grammar

**Allowlist (chain segments):** `npm`, `node`, `npx`, `pnpm`, `yarn` only (same `ALLOWED_EVIDENCE_EXECUTABLES`).

**Chain operator:** `&&` only, outside quotes; segments trimmed; empty segments rejected.

**Positive:** `npm run typecheck && npm test`; `node a.mjs && npm test`; multi-segment all allowlisted.

**Reject matrix:** `;`, `|`, lone `&`, `>`, `<`, `>>`, backticks, `$VAR` / `$(...)` / `${...}`, newlines; non-allowlisted first token in any segment; `scripts/… && …` and venv python in multi-segment chains (Phase A single-segment only).

**Execution:** `execFileSync` per segment, no `shell: true`; stop on first non-zero; concatenate stdout.
