# Release manifest — v{TARGET_VERSION}

**Created:** {YYYY-MM-DD}
**Current version:** {from package.json}
**Target version:** v{TARGET_VERSION}
**Bump type:** patch | minor | major
**Profile:** patch | minor | major
**Operator approved scope:** no | yes ({date})
**Worker model pin:** {provider/id, set once} — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none | yes ({date}, {reason}) — record before any mid-release pin change

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | {n} | {profile limit} | PASS / WARN |
| Bug fixes | {n} | 3–5 | PASS / WARN |
| Enhancements | {n} | {profile limit} | PASS / WARN |
| **Total tasks** | {n} | {profile cap} | PASS / WARN |

**Profile audit:** PASS | PASS with operator override | FAIL (do not proceed)

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-### | #NNN | doc / bug / enh | S/M | … | Closes / Partial |

**Release scope ID:** comma-separated SP-IDs for `spine plan`, `spine batch start`, and `spine run sequence` (e.g. `SP-483,SP-460,SP-438`). No spaces.

---

## Sequence runner (Phase 4)

The manifest is the operator contract; the CLI takes the **scope ID string**, not the manifest file path.

```bash
spine tasks validate <SP-IDs...>
spine plan <release-scope-id>
spine run sequence <release-scope-id> --dry-run
spine run sequence <release-scope-id>    # detached — omit --attached (#163)
```

Per-wave manual loop (alternative to full sequence):

```bash
spine batch start <release-scope-id> --wave N
spine status --diagnose
spine gate approve && spine integrate && npm install && spine batch complete
```

**Regression gate** (run after each integrate, before next wave — full reference: [post-integrate-regression-gate.md](../../skills/spine-release-operator/references/post-integrate-regression-gate.md)):

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${WAVE:-main}.log
test "${PIPESTATUS[0]}" -eq 0
```

Do **not** use `| tail` alone for pass/fail — verify exit code.

**Operator gates** (human only — sequence does not auto-approve without explicit flags):

1. **Approve this manifest** (operator sign-off on scope) — set `Operator approved scope: yes` above. **Phase 4 HARD STOP** without it (F1, [#249](https://github.com/beettlle/pi-spine/issues/249))
2. `spine gate approve` per integrate wave
3. Publish approval before `npm version <bump>`

**Model pin policy ([#248](https://github.com/beettlle/pi-spine/issues/248)):** one worker pin for the release. Do not mid-release-edit `.spine/spine-config.json` agent pins; escalate models only on content/contract failure, never quota/403 or launch storms. Any in-release override must be recorded in `Agent pin override` above **before** applying. See [post-mortem F7](../../../docs/release/post-mortem-v2.12.1.md).

**Proof gate:** optional pre-publish dry-run (e.g. patch scope with operator touching only gate approve + publish approval; no `npm publish` during proof).

Filled example: [`docs/release/manifest-v1.10.0-example.md`](../../../docs/release/manifest-v1.10.0-example.md)

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #90 | doc | SP-### | create-spine-tasks (lean) |

---

## Wave plan snapshot

```text
(paste output of: spine plan <release-scope>)
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| SP-### / #NNN | enh | Exceeds patch profile; defer to v1.6.0 |
| #117 | epic | v2.3 module split — out of minor scope |

---

## Risks and blockers

- {e.g. 7 M-sized tasks in full pending plan — release scope excludes them}
- {e.g. #156 release CI gate — separate enhancement}

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD` (typecheck, lint, tests, coverage — CI parity)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: patch | minor | major
- [ ] `npm version <bump>` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
