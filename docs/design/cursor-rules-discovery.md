# Cursor rules auto-discovery for spine workers

**Document type:** Explanation + reference  
**Audience:** Operators and contributors adopting pi-spine on Cursor-based projects  
**Related:** FR-WORK-05 (PRD §7.5), FR-REV-08 (PRD §7.6), SP-089–094, SP-248–253

---

## Summary

When a consumer repo has `.cursor/rules/`, pi-spine **auto-selects** a bounded subset of Cursor rule files and injects them into batch worker prompts (FR-WORK-05). Selection uses:

1. A **committed manifest** (`.spine/rules-manifest.json`) produced by scanning `.cursor/rules/`
2. A **rules profile** (`.spine/rules-profile.json`) that controls always-include, never-include, and discovery exclusions
3. **PROMPT File Scope** — glob-triggered rules match task paths via **micromatch**
4. **`config.standards`** — explicit paths **append** after auto-selection (deduped)
5. **`config.neverLoad`** — blocklist applied to all tiers

Projects **without** `.cursor/rules/` keep the static FR-WORK-05 path: only `referenceDocs` and `standards` from `.spine/spine-config.json` are injected.

The default profile always includes **`taskplane-worker-cursor.mdc`** so workers receive task-packet execution guidance even when that rule is manual-only in Cursor IDE.

---

## Why manifest + profile?

| Concern | Approach |
|---------|----------|
| Reproducible selection across lanes/worktrees | Commit `.spine/rules-manifest.json` to git |
| Operator control without editing every rule | Profile overrides (`alwaysInclude`, `neverInclude`, exclusions) |
| Task-relevant language packs | Glob rules match PROMPT File Scope (not the whole rules tree) |
| Explicit project overrides | `config.standards` appends on top of auto-selection |
| Bounded prompt size | 48-rule cap at selection; 32 KiB byte cap at load |

Cursor IDE loads rules interactively; spine workers need a **deterministic, auditable** subset per task. The manifest is the inventory; the profile and File Scope are the filters.

---

## Files

| Path | Git | Role |
|------|-----|------|
| `.cursor/rules/**/*.{mdc,md}` | Yes (project choice) | Source rule files with YAML frontmatter |
| `.spine/rules-profile.json` | Yes | Worker/discovery profile (copied from `templates/rules-profile.json` on init) |
| `.spine/rules-manifest.json` | **Yes — committed** | Discovery output: classified rules + excluded entries |
| `.spine/spine-config.json` | Yes | `referenceDocs`, `standards`, `neverLoad` arrays |

**Not gitignored:** `.spine/rules-manifest.json` is intentionally tracked. Runtime artifacts under `.spine/runtime/` remain gitignored.

---

## Discovery (`discoverCursorRules`)

Triggered by `spine init`, `spine rules discover`, and `spine rules sync`.

1. Recursively scan `.cursor/rules/**/*.{mdc,md}` (max **200** files; oversize files > **512 KiB** are flagged)
2. Parse YAML frontmatter (`alwaysApply`, `description`, `globs`)
3. Apply profile **discovery** exclusions:
   - `excludeRelPaths` — exact paths under `.cursor/rules/`
   - `excludePatterns` — **micromatch** patterns against rule `relPath`, basename, and stem
4. Classify each included rule:

| `spineClass` | Condition |
|--------------|-----------|
| `always` | `alwaysApply: true` in frontmatter |
| `glob` | Non-empty `globs` array |
| `manual` | Neither always nor glob (IDE @-mention only; included only via profile/config) |
| `excluded` | Matched exclusion — listed in manifest `excluded[]`, not selectable |

5. Write `.spine/rules-manifest.json` atomically with `generatedAt`, `rulesRoot`, `rules[]`, `excluded[]`, optional `warnings[]`

Default profile exclusions (merged with file overrides): `*-brutal-audit` patterns, audit workflow templates, and taskplane prompt/status templates.

---

## Selection (`selectRulesForWorker`)

Used by batch workers and `spine rules select --task <id>`. Requires a manifest (committed or freshly discovered).

**Priority order** (lower rank = earlier in injected list):

| Source | Description |
|--------|-------------|
| `alwaysInclude` | Profile paths (default: `taskplane-worker-cursor.mdc`) |
| `always` | Manifest rules with `alwaysApply: true` (e.g. `critical-rules-quick-reference.mdc`) |
| `glob` | Manifest glob rules whose frontmatter globs match PROMPT File Scope |
| `standards` | Paths from `config.standards` that resolve under `.cursor/rules/` |

After merging, apply blocklists:

- `profile.worker.neverInclude`
- `config.neverLoad`

Sort by priority, then `relPath`. Cap at **48** rules (`DEFAULT_SELECT_MAX_RULES`); lower-priority paths appear in `dropped[]`.

**Append semantics:** `config.standards` does **not** replace auto-selection — it adds paths after always/glob rules (deduped). Greenfield `spine init` sets `standards: []` so auto-discovery is the default; operators may append explicit paths for legacy or supplemental rules.

**Reference docs:** `config.referenceDocs` load **after** selected rules (also deduped, subject to `neverLoad` and byte cap).

---

## Glob matching (micromatch)

Glob-triggered rules match when **any** frontmatter glob matches **any** PROMPT File Scope entry.

File Scope entries are expanded into **probe paths** before matching:

- Directory paths without extensions → synthetic probes (`__probe__.mjs`, `.ts`, `.swift`, …)
- `dir/*` and `dir/**` wildcards → probes under that prefix
- In-path `*` → replaced with `__probe__` for matching

**Empty File Scope** never activates glob rules (only `alwaysInclude`, `always`, and `standards` apply).

Disable glob matching project-wide: set `"globMatch": false` in `.spine/rules-profile.json` → `"worker"`.

Preview selection for a task:

```bash
spine rules select --task SP-042
spine rules select --task SP-042 --json
```

---

## Reviewer injection (FR-REV-08)

Cross-model reviewers spawned by the batch engine receive a **bounded subset** of Cursor rules in the **system prompt** only (not the user review request). Selection mirrors worker discovery (same committed manifest and profile file) but uses `profile.reviewer.*` and review-type-specific scope paths.

**Symmetry with workers (FR-WORK-05):** Same manifest, micromatch glob matching, `config.standards` append, and `config.neverLoad` blocklist. **Differences:** reviewer profile excludes worker execution rules (`taskplane-worker-cursor.mdc`, `taskplane-task-authoring.mdc` by default); **16 KiB** byte cap (`DEFAULT_REVIEWER_CONTEXT_BYTE_CAP`); **no** `referenceDocs` injection; rules cap defaults to **32** (`profile.reviewer.maxRules`).

### Reviewer profile

`templates/rules-profile.json` includes a `reviewer` block (merged on load):

| Field | Role |
|-------|------|
| `enabled` | When `false`, selection returns empty paths (journal `mode: auto`, zero bytes) |
| `alwaysInclude` | Paths relative to `.cursor/rules/` (prepended before manifest `always` rules) |
| `neverInclude` | Blocklist relative to `.cursor/rules/` (default excludes worker/task-authoring packs) |
| `globMatch` | When `true`, glob rules match review scope paths via micromatch |
| `maxRules` | Upper bound before byte cap (default **32**) |

Set `"enabled": false` in `.spine/rules-profile.json` to disable reviewer rule injection project-wide.

### Review-type scope table

`resolveReviewScopePaths` supplies scope paths to `selectRulesForReviewer` before load:

| Review type | Scope paths for glob matching | Notes |
|-------------|------------------------------|-------|
| `plan` | PROMPT **File Scope** | Same paths workers use for the task packet |
| `code` | `git diff --name-only` changed paths | Optional baseline: `git diff --name-only <baseline>..HEAD` |
| `final` | **Empty** | Only `alwaysInclude`, manifest `alwaysApply`, and `standards` apply |

Noise paths (`.DONE`, `.reviews/`, `.spine/runtime/`) are filtered from scope.

**Selection priority** (same shared core as workers): `alwaysInclude` → manifest `always` → glob (when scope non-empty and `globMatch` enabled) → `config.standards` append. Apply `neverInclude` and `config.neverLoad`, sort, cap at `maxRules`.

### Reviewer context build

`buildReviewerContext` (SP-250) is called from `buildReviewerSystemPrompt` during review spawn (SP-251):

1. Skip when `.cursor/rules/` absent (`mode: skipped`)
2. Load profile; on error return empty text (`mode: degraded`)
3. Load committed manifest or discover in-memory if missing
4. `selectRulesForReviewer` with resolved scope paths
5. `loadContextDocEntries` with **16 KiB** cap — may truncate tail; journal lists full `selection.paths`
6. Append `## Project standards for review` block to system prompt

**Stub safety:** `SPINE_REVIEW_STUB=1` exits before `buildReviewerSystemPrompt` — no rules loaded on stub path.

**Journal:** Each build emits `reviewer.rules_selected` with `reviewType`, `scopePaths`, `paths`, `capped`, `bytesUsed`, `mode` (`skipped` \| `degraded` \| `auto`), `manifestSource`, `profileSource`, `entries`, and optional `truncated` / error fields.

### CLI preview (reviewer role)

Operator preview mirrors worker `spine rules select --task <id>` with reviewer flags (SP-252):

```bash
spine rules select --task SP-042                              # worker (default)
spine rules select --role reviewer --review-type plan --task SP-042
spine rules select --role reviewer --review-type code --task SP-042
spine rules select --role reviewer --review-type code --task SP-042 --baseline abc1234
spine rules select --role reviewer --review-type final --task SP-042
spine rules select --role reviewer --review-type code --task SP-042 --json
```

JSON output includes `reviewType`, `scopePaths`, and `selection` (same shape as worker preview).

---

## Worker injection

`buildWorkerContextAsync` (SP-092) runs when `.cursor/rules/` exists:

1. Load rules profile
2. Load committed manifest, or discover in-memory if missing (`manifestSource: "discovered"`)
3. Call `selectRulesForWorker` with PROMPT File Scope + config
4. Load file contents in selection order, then append unmatched `referenceDocs`
5. Enforce **32 KiB** total byte cap (`DEFAULT_WORKER_CONTEXT_BYTE_CAP`) — may truncate tail text; journal still lists full `selection.paths`

When `.cursor/rules/` is absent, fall back to static `buildWorkerContext` (referenceDocs + standards only).

**Stub safety:** `SPINE_WORKER_STUB=1` / `spine-worker-runner.mjs --stub` exits before context build — unchanged.

**Journal:** Each context build emits `worker.rules_selected` with `mode` (`auto` | `static`), `manifestSource`, `paths`, `entries`, `globMatchEnabled`, `fileScopeProbeCount`, cap metadata, etc.

---

## CLI commands

```bash
spine rules discover [--json]   # Scan + write manifest
spine rules sync [--json]       # Alias: discover with write
spine rules select --task <id> [--json]   # Preview worker selection (default --role worker)
spine rules select --role reviewer --review-type plan|code|final --task <id> [--baseline <sha>] [--json]
spine rules --help
```

| Command | Writes manifest | Needs manifest |
|---------|-----------------|----------------|
| `discover` | Yes | No |
| `sync` | Yes | No |
| `select --task` | No | Yes (run `sync` first) |

---

## Init flow

`spine init` (when `.cursor/rules/` exists):

1. Copy `templates/rules-profile.json` → `.spine/rules-profile.json`
2. Run discovery → write `.spine/rules-manifest.json`
3. Set `standards: []` in `.spine/spine-config.json` (auto-discovery default)

**Commit** the manifest after init or when rules change. Re-run `spine rules sync` before batch start if `.cursor/rules/` changed locally.

---

## Doctor

When `.cursor/rules/` or `.spine/rules-profile.json` exists, `spine doctor` checks manifest freshness:

| Code | Meaning | Fix |
|------|---------|-----|
| `RULES_MANIFEST_MISSING` | No committed manifest | `spine rules sync` |
| `RULES_MANIFEST_STALE` | On-disk manifest differs from rescan (ignores `generatedAt`) | `spine rules sync` |

Warnings are advisory (`warning: true`) — they do not block batch start.

---

## Default profile (template)

```json
{
  "profileVersion": 1,
  "worker": {
    "alwaysInclude": ["taskplane-worker-cursor.mdc"],
    "neverInclude": [],
    "globMatch": true
  },
  "reviewer": {
    "enabled": true,
    "alwaysInclude": [],
    "neverInclude": [
      "taskplane-worker-cursor.mdc",
      "taskplane-task-authoring.mdc"
    ],
    "globMatch": true,
    "maxRules": 32
  },
  "discovery": {
    "excludePatterns": ["*-brutal-audit"],
    "excludeRelPaths": [
      "audit-workflow.mdc",
      "cursor-integration.mdc",
      "taskplane/prompt-template.md",
      "taskplane/status-template.md"
    ]
  }
}
```

Customize per project: add language-specific always-includes, exclude noisy packs, or disable glob matching.

---

## Operator checklist

1. **After adding/changing rules:** `spine rules sync` → commit `.spine/rules-manifest.json`
2. **Before debugging worker context:** `spine rules select --task <id>`
3. **When workers miss a language pack:** ensure PROMPT File Scope includes paths that match the rule's globs, or add the rule path to `config.standards`
4. **When prompts truncate:** large always-on rules consume the 32 KiB cap first — narrow `alwaysInclude`, use `neverLoad`, or split tasks with smaller File Scope
5. **Audit selection in batch:** inspect journal `worker.rules_selected` and `reviewer.rules_selected` events
6. **When reviewers miss language packs:** for plan reviews, ensure PROMPT File Scope matches rule globs; for code reviews, changed paths must match globs (or add paths to `config.standards`)

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [bootstrap-checklist.md](../adoption/bootstrap-checklist.md) | First-time init including rules manifest |
| [operator-runbook.md](../adoption/operator-runbook.md) | Day-2 rules maintenance |
| [README.md](../../README.md) | Contributor Cursor rules overview |
| [PRD.md](../PRD.md) | FR-WORK-05 (workers), FR-REV-08 (reviewers) |
