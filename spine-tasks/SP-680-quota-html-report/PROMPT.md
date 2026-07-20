# Task: SP-680 — Quota HTML report renderer

**Created:** 2026-07-20
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** HTML renderer from snapshot JSON; self-contained; no secrets.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0

## Mission

Partial #220 — Render a self-contained HTML evidence brief from a quota snapshot: masthead (claim, period, source health), sorted remaining-headroom table with honest unknowns, burn/ETA when estimable, role×model attribution (config vs observed), collapsed caveats/glossary. No bare KPI wallpaper; no secrets.

## Dependencies

- **Task:** SP-678 (snapshot schema required)

## Context to Read First

- `src/metrics/quota-snapshot.mjs`
- GitHub #220 HTML report section
- `Parent split: SP-678 — snapshot builder`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/metrics/quota-html.mjs`
- `tests/metrics/quota-html.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/metrics/quota-html.test.mjs` |
| fileScopeMustChange | `src/metrics/quota-html.mjs`, `tests/metrics/quota-html.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm snapshot schema fields from SP-678
- [ ] Decide HTML embedding strategy (inline CSS, no CDN required)

### Step 1: Renderer

- [ ] Implement `renderQuotaHtml(snapshot) → string`
- [ ] Include masthead, headroom table, attribution, caveats
- [ ] Escape all untrusted strings (XSS-safe)

### Step 2: Tests + CLI hook point

- [ ] Smoke test rendering from fixture snapshot
- [ ] Export helper for SP-679 `--open` / write-beside-JSON (document integration; wire if SP-679 already landed, else leave importable API)

### Step 3: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/QUICK-REFERENCE.md` — SP-682

## Completion Criteria

- [ ] HTML self-contained and secret-free
- [ ] Partial #220 report complete

## Do NOT

- Load remote scripts/CDNs as a hard requirement
- Include API keys or prompt bodies
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-680): quota HTML report renderer (#220)`
