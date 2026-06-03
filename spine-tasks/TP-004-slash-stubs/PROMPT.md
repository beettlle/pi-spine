# Task: TP-004 — Register pi slash command stubs

**Created:** 2026-05-31
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Pi extension API wiring for eleven slash commands; incorrect registration breaks pi package load (M6).
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Replace the Phase 0 extension stub with a proper pi extension that registers all PRD §15.1 slash commands. Each command returns a clear "not implemented yet" message (Phase 0 stubs only — no batch engine).

## Dependencies

- **None**

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md`

**Tier 3:**
- `pi-spine-PRD.md` — §15.1 Pi slash commands, §15.2 CLI commands
- `extensions/spine-orchestrator.ts` — current stub to replace
- Taskplane `extensions/taskplane/extension.ts` — `pi.registerCommand` pattern

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `extensions/spine-orchestrator.ts`
- `extensions/spine/slash-commands.ts` (new)
- `tests/slash-commands.test.mjs` (new, static export test if full pi host unavailable)

## Steps

### Step 0: Preflight

- [ ] Read PRD §15.1 command list
- [ ] Confirm pi extension entry shape: `export default function (pi: ExtensionAPI)`

### Step 1: Implement slash command registration

> **Plan-review checkpoint**

- [ ] Create `extensions/spine/slash-commands.ts` exporting `registerSpineSlashCommands(pi)`
- [ ] Register commands: `spine`, `spine-plan`, `spine-status`, `spine-pause`, `spine-resume`, `spine-abort`, `spine-gate`, `spine-integrate`, `spine-settings`, `spine-deps`
- [ ] Note: PRD lists `/spine` for both guide and execute — register once with usage hint in description; batch execution lands Phase 2+
- [ ] Each handler calls `ctx.ui.notify(...)` with stub message naming the command and pointing to `spine help` / future phase
- [ ] Update `extensions/spine-orchestrator.ts` to import and call registrar; remove invalid stub return object

**Artifacts:**
- `extensions/spine/slash-commands.ts` (new)
- `extensions/spine-orchestrator.ts` (modified)

### Step 2: Add verification test

- [ ] Add `tests/slash-commands.test.mjs` that imports the module and asserts all command names are registered (mock `pi.registerCommand` collector) OR document manual `pi` smoke if extension host required
- [ ] Run targeted tests

### Step 3: Testing & Verification

- [ ] Run `npm run typecheck`
- [ ] Run `npm test` (full suite)
- [ ] Manual smoke: load extension in pi session and confirm `/spine` appears in command list (log result in STATUS.md)

### Step 4: Documentation & Delivery

- [ ] Update README.md slash commands section (stub status)
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `README.md` — list slash commands and stub status

## Completion Criteria

- [ ] Extension uses valid pi `ExtensionAPI` activate pattern
- [ ] All §15.1 commands registered with stub handlers
- [ ] Typecheck and tests pass

## Git Commit Convention

- **Step completion:** `feat(TP-004): complete Step N — description`

## Do NOT

- Implement batch engine, planner, or gate logic
- Modify `bin/spine.mjs` CLI beyond what typecheck requires

---

## Amendments (Added During Execution)
