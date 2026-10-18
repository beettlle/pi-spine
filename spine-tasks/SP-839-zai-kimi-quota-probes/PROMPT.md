# Task: SP-839 — Z.ai and Kimi Coding quota probes parse real responses

**Created:** 2026-10-17
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** A probe that reports `source: "live"` with nothing parsed looks like 0% usage and invites operators to start batches on an exhausted pool.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0
**Problem theory:** In `src/metrics/quota-probes.mjs`: `PROBE_URLS["kimi-coding"]` (36-41) is the Moonshot billing endpoint, which returns 401 for Kimi Coding plan keys. `extractLimit` (208) / `extractNumber` (225) require `Number.isFinite(value)`, so numeric strings are dropped. `probeZai` (244-268) looks for flat `used`/`total` on `data` or `data.data` and returns `source: "live"` after any HTTP 200. `ProbeResult` (63-70) has no window or reset fields. Consumers: `src/metrics/quota-cli.mjs` 42-141 (`formatHumanSummary`, `runQuotaReport`), `src/metrics/quota-snapshot.mjs` 243-247 (uses probe usage/limit when `source === "live"`). Tests mock the wrong flat shapes (`tests/metrics/quota-probes.test.mjs` 72-73, 123, 215, 238; `tests/metrics/quota-cli.test.mjs` 230).

## Mission

Closes #351 — `spine metrics quota` reports per-window percentage and reset time for Z.ai and Kimi Coding, and never reports `live` without parsed values. (SP-838 covers the Google/Anthropic runtime part of #351.)

1. **Numeric strings** — `extractNumber` / `extractLimit` coerce `typeof v === "string"` via `Number(v)` when the result is finite and ≥ 0.
2. **Z.ai** — iterate `data.limits[]` (response shape in #351): `TOKENS_LIMIT` with `unit: 3, number: 5` → window `"5h"`; `unit: 6, number: 1` → window `"weekly"`; `TIME_LIMIT` → window `"monthly_tool_calls"`. Read `percentage` and `nextResetTime` (epoch ms → ISO string).
3. **Kimi Coding** — URL `https://api.kimi.com/coding/v1/usages`, same Bearer key. Windows: `usages.limit_5h` → `"5h"` and `usages.limit_7d` → `"weekly"` from `used_ratio` (× 100) and `reset_time`; fall back to `limits[].detail` (`used` / `limit` strings, `resetTime`) for 5h and top-level `usage` for weekly.
4. **Result shape** — add optional `windows: Array<{ window, percentUsed, used?, limit?, resetAt? }>` to `ProbeResult`. Set `source: "live"` only when at least one window or usage value was parsed; otherwise `source: "unparsed"` with `error: "HTTP 200 but no quota fields recognised"`. Update the typedef and keep `"absent"` for missing keys / non-2xx.
5. **Render** — `formatHumanSummary` prints each window (`5h 63% (resets 2026-10-15T06:28:41Z)`); `--json` includes `windows`. `quota-snapshot.mjs` treats `unparsed` like `absent` (estimate fallback) and passes `windows` through.

## Dependencies

- **None**

## Context to Read First

- GitHub #351 (body: response shapes and suggested fix)
- `src/metrics/quota-probes.mjs` 30-310
- `src/metrics/quota-cli.mjs` 40-141
- `src/metrics/quota-snapshot.mjs` 230-260
- `tests/metrics/quota-probes.test.mjs`, `tests/metrics/quota-cli.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) for the stet step of the Contract only. No network in tests (mocked fetch).
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/metrics/quota-probes.mjs`
- `src/metrics/quota-cli.mjs`
- `src/metrics/quota-snapshot.mjs`
- `tests/metrics/quota-probes.test.mjs`
- `tests/metrics/quota-cli.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/metrics/quota-probes.test.mjs tests/metrics/quota-cli.test.mjs tests/metrics/quota-snapshot.test.mjs && bash scripts/spine-stet-contract-run.sh lenient SP-839` |
| fileScopeMustChange | `src/metrics/quota-probes.mjs`, `tests/metrics/quota-probes.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `runQuotaProbes`, `probeZai`, `probeKimi`, `extractNumber`, `extractLimit`
- [ ] Note SP-837 also edits `quota-snapshot.mjs` (different function); keep edits local to probe handling

### Step 1: Parsing

- [ ] Numeric-string coercion
- [ ] Z.ai `data.limits[]` windows; Kimi `/coding/v1/usages` windows
- [ ] `unparsed` source

**Artifacts:**
- `src/metrics/quota-probes.mjs` (modified)

### Step 2: Rendering

- [ ] Human and JSON output show windows; snapshot handles `unparsed`

**Artifacts:**
- `src/metrics/quota-cli.mjs` (modified)
- `src/metrics/quota-snapshot.mjs` (modified)

### Step 3: Tests

- [ ] Replace flat mocks with the real response bodies from #351
- [ ] HTTP 200 with unknown shape → `unparsed`
- [ ] Moonshot URL no longer called for `kimi-coding`

**Artifacts:**
- `tests/metrics/quota-probes.test.mjs` (modified)
- `tests/metrics/quota-cli.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-839-zai-kimi-quota-probes/.DONE`

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh lenient SP-839`. When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>`, citing lint/typecheck/test evidence. If stet itself fails, record a blocker; do not edit `.review/`.

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (`spine metrics quota`)

## Completion Criteria

- [ ] Z.ai and Kimi Coding windows reported with percentage and reset time
- [ ] `live` only when values parsed; tests use real shapes

## Git Commit Convention

- `fix(SP-839): parse Z.ai and Kimi Coding quota responses (#351)`

## Do NOT

- Add a Google usage probe (no public API; SP-748 / #277)
- Change runtime quota classification (SP-838)
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
