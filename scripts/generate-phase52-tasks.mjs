#!/usr/bin/env node
/**
 * One-shot generator for Phase 52 spine tasks (GitHub issues #71–#96).
 * Run: node scripts/generate-phase52-tasks.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TASKS_ROOT = "spine-tasks";
const DATE = "2026-07-02";

/** @type {Array<object>} */
const TASKS = [
  // --- Wave 0: Documentation (priority) ---
  {
    id: "SP-418",
    slug: "agent-outer-loop-doc",
    name: "Agent outer loop how-to doc",
    size: "S",
    review: { level: 0, label: "None", score: 1, assessment: "Docs-only how-to; no code paths." },
    issue: 90,
    closes: false,
    deps: [],
    mission:
      "Add canonical how-to **`docs/adoption/agent-orchestrated-waves.md`** for the external-agent multi-wave outer loop (responsibility split, per-wave land loop, diagnosis→action table, anti-patterns). Cross-link from operator-runbook and bootstrap-checklist. Partial delivery for GitHub #90 (docs surface; skill/slash in SP-419).",
    fileScope: [
      "docs/adoption/agent-orchestrated-waves.md",
      "docs/adoption/operator-runbook.md",
      "docs/adoption/bootstrap-checklist.md",
      "docs/QUICK-REFERENCE.md",
    ],
    contract: { testCommand: "true" },
    steps: [
      {
        title: "Preflight",
        items: ["Read GitHub issue #90 acceptance criteria", "Read operator-runbook §4 land loop"],
      },
      {
        title: "Author how-to doc",
        items: [
          "Create `docs/adoption/agent-orchestrated-waves.md` (Diátaxis how-to)",
          "Add responsibility split + recommended outer loop bash blocks",
          "Add diagnosis→agent action table and anti-patterns",
        ],
      },
      {
        title: "Cross-links",
        items: [
          "Link from operator-runbook (§4.2 or pointer)",
          "Link from bootstrap-checklist after-first-batch step",
          "Add one-line pointer in QUICK-REFERENCE.md",
        ],
      },
    ],
    docsMust: [
      "`docs/adoption/agent-orchestrated-waves.md` — new canonical how-to",
      "`docs/adoption/operator-runbook.md` — cross-link",
      "`docs/adoption/bootstrap-checklist.md` — cross-link",
    ],
  },
  {
    id: "SP-419",
    slug: "spine-orchestrate-skill-slash",
    name: "Spine-orchestrate skill and slash command",
    size: "M",
    review: {
      level: 1,
      label: "Plan Only",
      score: 3,
      assessment: "New pi skill + slash; touches extensions and skills tree.",
    },
    issue: 90,
    closes: true,
    deps: ["SP-418-agent-outer-loop-doc"],
    mission:
      "Ship discoverability surfaces for agent-orchestrated waves per #90: pi skill `spine-orchestrate-waves` (SKILL.md + references synced from SP-418 doc) and slash command `/spine-orchestrate` that emits wave plan + outer-loop checklist from `spine plan` — **no** auto gate approve/integrate. Closes #90.",
    fileScope: [
      "skills/spine-orchestrate-waves/**",
      "extensions/spine/slash-commands.ts",
      "package.json",
      "tests/extensions/spine-orchestrate-slash.test.ts",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/extensions/spine-orchestrate-slash.test.ts && npm run coverage:check",
      fileScopeMustChange: "skills/spine-orchestrate-waves/SKILL.md",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Preflight",
        items: ["Read SP-418 doc", "Read existing slash-commands.ts patterns"],
      },
      {
        title: "Skill package",
        items: [
          "Create `skills/spine-orchestrate-waves/SKILL.md` with triggers and decision tree",
          "Add `references/outer-loop.md` synced from docs/adoption/agent-orchestrated-waves.md",
        ],
      },
      {
        title: "Slash command",
        items: [
          "Add `/spine-orchestrate [pending|all] [--from-wave N]`",
          "Emit structured prompt: wave tasks + outer loop steps + skill link",
        ],
      },
      {
        title: "Wire package + tests",
        items: ["Register skill in package.json", "Add slash command unit test"],
      },
    ],
    docsMust: ["`docs/adoption/agent-orchestrated-waves.md` — note skill/slash surfaces"],
  },
  {
    id: "SP-420",
    slug: "cross-model-authoring-docs",
    name: "Cross-model PROMPT authoring docs",
    size: "M",
    review: { level: 0, label: "None", score: 2, assessment: "Multi-file docs/rules update; no runtime code." },
    issue: 84,
    closes: true,
    deps: [],
    mission:
      "Document cross-model authoring expectations for consumer repos: scoped `testCommand`, lane worktree ≠ dev checkout, reviewer context asymmetry (FR-REV-08), and self-contained PROMPT criteria. Update contract template, spine-task-authoring rule, operator runbook, and create-spine-tasks skill. Closes #84.",
    fileScope: [
      "skills/create-spine-tasks/references/contract-template.md",
      "skills/create-spine-tasks/SKILL.md",
      ".cursor/rules/spine-task-authoring.mdc",
      "docs/adoption/operator-runbook.md",
    ],
    contract: { testCommand: "true" },
    steps: [
      {
        title: "Preflight",
        items: ["Read GitHub issue #84 and reaprime batch evidence", "Read FR-REV-08 docs"],
      },
      {
        title: "Contract + skill updates",
        items: [
          "Add cross-model section to contract-template.md (scoped testCommand table)",
          "Link cross-model section from create-spine-tasks SKILL.md",
        ],
      },
      {
        title: "Operator + rule updates",
        items: [
          "Add cross-model subsection to operator-runbook near agent model pins",
          "Update spine-task-authoring.mdc with reviewer context asymmetry",
        ],
      },
      {
        title: "Delivery",
        items: ["Close GitHub issue #84", "Verify links to #78/#80 engine issues"],
      },
    ],
    docsMust: [
      "`skills/create-spine-tasks/references/contract-template.md`",
      "`.cursor/rules/spine-task-authoring.mdc`",
      "`docs/adoption/operator-runbook.md`",
    ],
  },
  // --- Bugs batch 1 (3) ---
  {
    id: "SP-421",
    slug: "diagnosis-primary-failure-class",
    name: "Diagnosis primary failure class taxonomy",
    size: "S",
    review: {
      level: 2,
      label: "Plan + Code",
      score: 4,
      assessment: "Reconcile/diagnose headline logic; operator-facing.",
    },
    issue: 74,
    closes: true,
    deps: [],
    mission:
      "Fix misleading `spine status --diagnose` headline that says 'failed at worker launch' for DirtyWorktree, review_exhausted, and contract failures. Surface primary failure class per task with actionable suggestedCommand. Fix hasFailedTasks vs failedTasks inconsistency where present. Closes #74.",
    fileScope: [
      "src/batch/reconcile.mjs",
      "src/batch/diagnose.mjs",
      "tests/batch/diagnosis-failure-class.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/diagnosis-failure-class.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Preflight",
        items: ["Reproduce with batch 20260701T201456 fixture or journal excerpt from #74"],
      },
      {
        title: "Taxonomy + headline",
        items: [
          "Map classification → diagnosis headline + suggestedCommand",
          "Prefer task-level primary failure over generic worker-launch text",
        ],
      },
      {
        title: "Regression tests",
        items: [
          "Add tests for DirtyWorktree, review_exhausted, contract_failed headlines",
          "Assert hasFailedTasks aligns with failed task list",
        ],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — diagnosis table if behavior changes"],
  },
  {
    id: "SP-422",
    slug: "doctor-canonical-model-ids",
    name: "Doctor validates canonical pi model ids",
    size: "S",
    review: { level: 2, label: "Plan + Code", score: 4, assessment: "Settings/doctor validation; affects reviewer spawn." },
    issue: 76,
    closes: true,
    deps: [],
    mission:
      "Reject or normalize pi TUI display labels like `gemini-3.1-pro-preview [google]` in `spine settings set agents.reviewer.model` and `spine doctor`. Validate against canonical `provider/model` ids from `pi --list-models`. Closes #76.",
    fileScope: [
      "src/config/model-id.mjs",
      "src/doctor/agent-models.mjs",
      "src/cli/settings-set.mjs",
      "tests/doctor/model-id-validation.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/doctor/model-id-validation.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Preflight",
        items: ["Capture failing label from reaprime repro (#76)"],
      },
      {
        title: "Model id resolver",
        items: [
          "Add helper to resolve display label → canonical id (or fail with hint)",
          "Wire into settings set and doctor checks",
        ],
      },
      {
        title: "Tests",
        items: ["Test display label rejected or mapped", "Test canonical id passes"],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — agent model pin examples"],
  },
  {
    id: "SP-423",
    slug: "sequence-preflight-pi-dir",
    name: "Sequence preflight .pi/ and error propagation",
    size: "S",
    review: { level: 2, label: "Plan + Code", score: 3, assessment: "CLI preflight UX; small surface." },
    issue: 81,
    closes: true,
    deps: [],
    mission:
      "When `spine run sequence` preflight fails (e.g. untracked `.pi/`), print the same remediation as `spine preflight` instead of silent exit 1. Exclude `.pi/` from git-clean check (like `.spine/runtime`). Closes #81.",
    fileScope: [
      "src/config/spine-preflight-lib.mjs",
      "src/batch/sequence.mjs",
      "tests/batch/sequence-preflight.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/sequence-preflight.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Preflight git-clean",
        items: ["Exclude `.pi/` from git-clean dirty paths", "Document in spine init gitignore guidance if needed"],
      },
      {
        title: "Sequence error surfacing",
        items: ["Propagate preflight failure reason to sequence CLI stderr", "Exit non-zero with actionable message"],
      },
      {
        title: "Tests",
        items: ["Test sequence with only `?? .pi/` succeeds or warns", "Test preflight failure prints message"],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — `.pi/` preflight note"],
  },
  // --- Enhancement 1 (3 bugs : 1 enh) ---
  {
    id: "SP-424",
    slug: "limbo-detect-leaf",
    name: "Limbo detection leaf module",
    size: "S",
    review: { level: 2, label: "Plan + Code", score: 4, assessment: "Refactor leaf; breaks reconcile↔limbo cycle (#83-A)." },
    issue: 83,
    closes: false,
    deps: [],
    mission:
      "Extract pure `isPostMergeLimbo()` predicates to `src/batch/limbo-detect.mjs` (SP-116 strangler pattern). Break import cycle between `reconcile.mjs` and `post-merge-limbo.mjs`. Slice A of #83.",
    fileScope: [
      "src/batch/limbo-detect.mjs",
      "src/batch/reconcile.mjs",
      "src/batch/post-merge-limbo.mjs",
      "tests/batch/limbo-detect.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/limbo-detect.test.mjs tests/batch/post-merge-limbo*.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Extract leaf",
        items: [
          "Create limbo-detect.mjs with pure predicates (state readers only)",
          "Update reconcile + post-merge-limbo imports",
        ],
      },
      {
        title: "Regression",
        items: ["Run existing post-merge-limbo test suite", "Add unit tests for extracted predicates"],
      },
    ],
    docsMust: [],
  },
  // --- Bugs batch 2 ---
  {
    id: "SP-425",
    slug: "contract-failed-terminal-path",
    name: "Contract failed terminal path",
    size: "M",
    review: { level: 2, label: "Plan + Code", score: 5, assessment: "Engine review path; affects operator taxonomy." },
    issue: 85,
    closes: true,
    deps: ["SP-421-diagnosis-primary-failure-class"],
    mission:
      "When final `contract.verified` fails, classify as `contract_failed` (not final REVISE) and do not consume `maxFinalAttempts` or re-run worker by default. Journal/metrics distinguish contract vs reviewer failure. Closes #85.",
    fileScope: [
      "src/batch/engine-lanes/review.mjs",
      "src/batch/reconcile.mjs",
      "tests/batch/contract-failed-terminal.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/contract-failed-terminal.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Terminal path",
        items: [
          "Add contract_failed exitReason/classification in review.mjs",
          "Skip worker rework loop when checks indicate testCommand/env failure",
        ],
      },
      {
        title: "Reconcile + metrics",
        items: ["Surface contract_failed in diagnose headline", "Distinguish in run-metrics journal fields"],
      },
      {
        title: "Regression fixture",
        items: ["Test journal path from #85 excerpt (APPROVE code → contract fail)"],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — contract_failed recovery"],
  },
  {
    id: "SP-426",
    slug: "contract-verify-max-buffer",
    name: "Contract verify maxBuffer fix",
    size: "S",
    review: { level: 1, label: "Plan Only", score: 2, assessment: "Single spawnSync option change + error surfacing." },
    issue: 86,
    closes: true,
    deps: [],
    mission:
      "Increase `runContractTestCommand` maxBuffer (or stream output) so full `flutter test` is not killed at 256KB with exit 255. Surface ENOBUFS with clear operator message. Closes #86.",
    fileScope: ["src/batch/contract-verify.mjs", "tests/batch/contract-verify-buffer.test.mjs"],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/contract-verify-buffer.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Buffer fix",
        items: ["Raise maxBuffer or use spawn+stream aggregation", "Detect buffer overflow → explicit error text"],
      },
      {
        title: "Tests",
        items: ["Simulate large stdout without killing child", "Assert overflow message mentions scoped testCommand"],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — testCommand output limits"],
  },
  {
    id: "SP-427",
    slug: "dirty-worktree-coverage-hygiene",
    name: "Dirty worktree coverage artifact hygiene",
    size: "M",
    review: { level: 2, label: "Plan + Code", score: 5, assessment: "Lane commit gate; stet consumer impact." },
    issue: 73,
    closes: true,
    deps: [],
    mission:
      "Prevent PASS tasks from failing DirtyWorktree when `extension/coverage/**` is regenerated by `npm test` after auto-commit. Auto-restore or exclude ephemeral coverage from dirty check when not in task file scope. Closes #73.",
    fileScope: [
      "src/batch/engine-lanes/commit.mjs",
      "src/batch/lane-dirty-check.mjs",
      "tests/batch/dirty-worktree-coverage.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/dirty-worktree-coverage.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Dirty check policy",
        items: [
          "Exclude or auto-clean coverage artifact paths after test gates",
          "Align terminal-success vs failed classification",
        ],
      },
      {
        title: "Regression",
        items: ["Fixture: final PASS + lane commit + coverage M files → task succeeds"],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — committed coverage reports caveat"],
  },
  // --- Enhancement 2 ---
  {
    id: "SP-428",
    slug: "resume-validation-detached-spawn-leaves",
    name: "Resume validation and detached spawn leaves",
    size: "M",
    review: { level: 2, label: "Plan + Code", score: 5, assessment: "Two leaf extractions (#83-B/C)." },
    issue: 83,
    closes: false,
    deps: ["SP-424-limbo-detect-leaf"],
    mission:
      "Break remaining reconcile cycles (#83): extract pure resume validation helpers to a leaf module and detached spawn argv builders to `detached-spawn.mjs` so post-merge-limbo does not import full detached-start.mjs.",
    fileScope: [
      "src/batch/resume-validation.mjs",
      "src/batch/detached-spawn.mjs",
      "src/batch/resume-multi-validate.mjs",
      "src/batch/detached-start.mjs",
      "src/batch/post-merge-limbo.mjs",
      "tests/arch/import-cycles.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/arch/import-cycles.test.mjs tests/batch/detached-start*.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Resume validation leaf",
        items: ["Move pure validation helpers out of resume-multi-validate.mjs", "No reconcile import in leaf"],
      },
      {
        title: "Detached spawn leaf",
        items: ["Extract spawn argv builders to detached-spawn.mjs", "Rewire post-merge-limbo imports"],
      },
      {
        title: "Arch guard",
        items: ["Add import-cycles test with shrinking allowlist for reconcile/detached-start/limbo cluster"],
      },
    ],
    docsMust: [],
  },
  // --- Bugs batch 3 ---
  {
    id: "SP-429",
    slug: "dirty-worktree-symlink-drift",
    name: "Dirty worktree symlink drift handling",
    size: "S",
    review: { level: 2, label: "Plan + Code", score: 4, assessment: "Worktree hook symlink edge case." },
    issue: 87,
    closes: true,
    deps: [],
    mission:
      "Ignore or repair symlink-only dirt from worktreeSetupHook paths (e.g. `assets/bundled_skins`) after final PASS — do not fail DirtyWorktree on symlink deletion drift. Closes #87.",
    fileScope: [
      "src/batch/lane-dirty-check.mjs",
      "tests/batch/dirty-worktree-symlink.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/dirty-worktree-symlink.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Symlink policy",
        items: ["Detect symlink-only dirty state from hook paths", "Re-run hook or exclude from dirty gate"],
      },
      {
        title: "Tests",
        items: ["Fixture: PASS + symlink deletion → task succeeds"],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — worktreeSetupHook symlink pattern"],
  },
  {
    id: "SP-430",
    slug: "gitignored-dirty-worktree-fix",
    name: "Gitignored dirty worktree detection fix",
    size: "M",
    review: { level: 2, label: "Plan + Code", score: 5, assessment: "Lane commit gate; index vs worktree dirtiness." },
    issue: 95,
    closes: true,
    deps: ["SP-427-dirty-worktree-coverage-hygiene"],
    mission:
      "Fix GitignoredDirtyWorktree false failures when gitignored paths (`extension/coverage/`, `node_modules/`) exist only in worktree after npm test — not in index. Do not suggest `git rm --cached` when paths are untracked. Optional auto `git clean -fdX` for known artifact dirs. Closes #95.",
    fileScope: [
      "src/batch/lane-dirty-check.mjs",
      "src/batch/engine-lanes/commit.mjs",
      "tests/batch/gitignored-dirty-worktree.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/gitignored-dirty-worktree.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Index vs worktree",
        items: [
          "Distinguish index-tracked vs worktree-only gitignored dirt",
          "Fix remediation message when ls-files empty",
        ],
      },
      {
        title: "Auto-clean policy",
        items: ["Optional clean gitignored artifact dirs before dirty validation"],
      },
      {
        title: "Regression",
        items: ["Reproduce batch 20260702T061256 SP-011 scenario"],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — gitignored artifact dirs"],
  },
  {
    id: "SP-431",
    slug: "sequence-auto-approve-flag",
    name: "Sequence --auto-approve-gate CLI flag",
    size: "S",
    review: { level: 2, label: "Plan + Code", score: 3, assessment: "CLI flag exposure; safety in SP-390." },
    issue: 79,
    closes: true,
    deps: ["SP-390-sequence-auto-approve-safety"],
    mission:
      "Expose `--auto-approve-gate` in `spine run sequence` argument parsing (wired to existing SP-390 safety gates). Closes #79.",
    fileScope: [
      "src/batch/sequence.mjs",
      "src/cli/sequence-args.mjs",
      "tests/batch/sequence-auto-approve-flag.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/sequence-auto-approve-flag.test.mjs tests/batch/sequence-auto-approve.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "CLI flag",
        items: ["Add --auto-approve-gate to parseSequenceArgs", "Wire through to land loop between waves"],
      },
      {
        title: "Tests + docs",
        items: ["Test flag honored under stub; refused for real pi without --force", "Document in runbook"],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — sequence auto-approve"],
  },
  // --- Enhancement 3 ---
  {
    id: "SP-432",
    slug: "import-cycle-arch-guard",
    name: "Import cycle arch guard and evidence leaf",
    size: "S",
    review: { level: 1, label: "Plan Only", score: 3, assessment: "Arch test + small evidence/gate leaf (#83-D/E)." },
    issue: 83,
    closes: true,
    deps: ["SP-428-resume-validation-detached-spawn-leaves"],
    mission:
      "Complete #83: break evidence↔reconcile↔gate triangle via thin read leaf if needed; add `tests/arch/import-cycles.test.mjs` that fails on cycles in reconcile/detached-start/post-merge-limbo cluster. Closes #83.",
    fileScope: [
      "src/batch/gate-evidence-read.mjs",
      "tests/arch/import-cycles.test.mjs",
      "src/batch/evidence.mjs",
      "src/batch/gate.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/arch/import-cycles.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Evidence leaf",
        items: ["Extract shared read helpers if cycle remains", "Rewire evidence/gate imports"],
      },
      {
        title: "Arch test",
        items: ["Static import graph test with zero cycles in target cluster", "Document leaf module purposes"],
      },
    ],
    docsMust: [],
  },
  // --- Bugs batch 4 ---
  {
    id: "SP-433",
    slug: "resume-force-skip-succeeded",
    name: "Resume force skip succeeded tasks",
    size: "M",
    review: { level: 2, label: "Plan + Code", score: 5, assessment: "Resume replay bug; collateral task regression." },
    issue: 88,
    closes: true,
    deps: [],
    mission:
      "On `resume --force`, skip tasks/segments already terminal-success in journal+batch-state — do not re-run contract/review for unrelated succeeded lanes. Closes #88.",
    fileScope: [
      "src/batch/resume-multi.mjs",
      "src/batch/resume-engine.mjs",
      "tests/batch/resume-skip-succeeded.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/resume-skip-succeeded.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Skip logic",
        items: [
          "Detect terminal success from journal (task.completed, lane.committed, .DONE)",
          "Restrict forced replay to retried/failed/pending segments only",
        ],
      },
      {
        title: "Regression",
        items: ["Multi-lane batch: one failed → retry → resume must not review.start succeeded IDs"],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — resume --force semantics"],
  },
  {
    id: "SP-434",
    slug: "attached-engine-single-lock",
    name: "Attached engine single-owner lock",
    size: "M",
    review: { level: 2, label: "Plan + Code", score: 5, assessment: "Concurrency safety on attached batches." },
    issue: 89,
    closes: true,
    deps: [],
    mission:
      "Reject second `--attached` start/resume when engine PID alive for same batch (unless explicit orphan handoff with journal event). Prevent sequence wave + resume collision. Closes #89.",
    fileScope: [
      "src/batch/attached-runner.mjs",
      "src/batch/detached-start.mjs",
      "src/batch/resume.mjs",
      "tests/batch/attached-engine-lock.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/attached-engine-lock.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Lock check",
        items: [
          "Store/check resilience.enginePid before attached spawn",
          "Fail fast with clear error when PID alive",
        ],
      },
      {
        title: "Handoff path",
        items: ["Optional --force orphans prior engine with journal event"],
      },
      {
        title: "Regression",
        items: ["Test: attached start → attached resume → expect fail-fast or clean handoff"],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — single attached engine"],
  },
  {
    id: "SP-435",
    slug: "sequence-detached-false-failure",
    name: "Sequence detached false failure exit",
    size: "M",
    review: { level: 2, label: "Plan + Code", score: 4, assessment: "Sequence orchestrator exit semantics." },
    issue: 72,
    closes: true,
    deps: ["SP-388-spine-run-sequence-cli"],
    mission:
      "Do not exit sequence with failure when detached engine PID is alive and batch phase is `running`. Show log tail for **current** batch only. Continue polling through waves. Closes #72.",
    fileScope: [
      "src/batch/sequence.mjs",
      "src/batch/detached-start.mjs",
      "tests/batch/sequence-detached-poll.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/sequence-detached-poll.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Poll semantics",
        items: [
          "Treat alive detached engine + running phase as success-in-progress",
          "Filter detached log tail to current batchId",
        ],
      },
      {
        title: "Tests",
        items: ["Sequence does not exit 1 while engine running", "Stale batch log not shown"],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — sequence detached monitoring"],
  },
  // --- Enhancement 4 ---
  {
    id: "SP-436",
    slug: "isolated-integrate-core",
    name: "Isolated base integrate core",
    size: "M",
    review: { level: 2, label: "Plan + Code", score: 6, assessment: "FR-WT-08 land path; multi-module." },
    issue: 91,
    closes: false,
    deps: [],
    mission:
      "Implement isolated integrate core (#91 / FR-WT-08 slice 1): record `baseBranchHeadAtStart` on batch start; integrate without `git checkout baseBranch` in projectRoot — use integrate worktree or plumbing merge. Human dirty tree on non-base branch no longer blocks.",
    fileScope: [
      "src/batch/integrate.mjs",
      "src/batch/integrate-worktree.mjs",
      "src/batch/lifecycle.mjs",
      "tests/batch/integrate-isolated.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/integrate-isolated.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Batch snapshot",
        items: ["Record baseBranchHeadAtStart + journal batch.base_snapshot"],
      },
      {
        title: "Isolated merge path",
        items: [
          "Add integrate-worktree.mjs",
          "Never checkout baseBranch in projectRoot during integrate",
        ],
      },
      {
        title: "Tests",
        items: ["Integrate succeeds with dirty human worktree on main (uncommitted)", "Conflict path unchanged"],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — concurrent development (interim)"],
  },
  // --- Bugs batch 5 ---
  {
    id: "SP-437",
    slug: "sequence-continue-after-merge-blocked",
    name: "Sequence continue after merge_blocked wave",
    size: "M",
    review: { level: 2, label: "Plan + Code", score: 4, assessment: "Sequence wave iteration policy." },
    issue: 82,
    closes: true,
    deps: ["SP-387-sequence-runner-core"],
    mission:
      "When wave N hits merge_blocked with partial success, sequence should continue independent later waves (per dependencies.json) or print explicit skip rationale — not silently exit after wave 0. Closes #82.",
    fileScope: [
      "src/batch/sequence.mjs",
      "src/batch/sequence-waves.mjs",
      "tests/batch/sequence-merge-blocked-continue.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/sequence-merge-blocked-continue.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Wave policy",
        items: [
          "Evaluate deps for waves 1+ when wave 0 merge_blocked",
          "Continue or emit structured skip message per §17.4",
        ],
      },
      {
        title: "Tests + docs",
        items: ["Fixture: 3-wave plan, wave 0 partial → wave 1 starts if deps allow"],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — sequence partial wave behavior"],
  },
  {
    id: "SP-438",
    slug: "flutter-worktree-adoption-docs",
    name: "Flutter worktree adoption docs",
    size: "M",
    review: { level: 0, label: "None", score: 2, assessment: "Consumer adoption docs for #78/#80." },
    issue: 78,
    closes: false,
    deps: ["SP-420-cross-model-authoring-docs"],
    mission:
      "Document Flutter/reaprime lane worktree pitfalls: gitignored pubspec assets (#80), worktreeSetupHook symlink pattern, scoped testCommand, analyzer pollution from build/SourcePackages (#78). Add optional `spine init` hook template. Partial closes #78 and #80 (engine fixes remain separate if needed).",
    fileScope: [
      "docs/adoption/flutter-worktree-guide.md",
      "docs/adoption/operator-runbook.md",
      "templates/spine-worktree-setup-flutter.sh",
      "docs/adoption/bootstrap-checklist.md",
    ],
    contract: { testCommand: "true" },
    steps: [
      {
        title: "Guide",
        items: [
          "Create docs/adoption/flutter-worktree-guide.md",
          "Cover gitignored assets, hook symlink, analyze scope",
        ],
      },
      {
        title: "Templates + links",
        items: [
          "Add optional flutter worktree setup script template",
          "Cross-link from runbook, bootstrap, cross-model docs (SP-420)",
        ],
      },
      {
        title: "Issue updates",
        items: ["Comment on #78/#80 with doc path; close if acceptance met"],
      },
    ],
    docsMust: [
      "`docs/adoption/flutter-worktree-guide.md` — new guide",
      "`docs/adoption/operator-runbook.md` — Flutter section link",
    ],
  },
  {
    id: "SP-439",
    slug: "integrate-false-merge-conflict",
    name: "Integrate false merge conflict fix",
    size: "M",
    review: { level: 2, label: "Plan + Code", score: 5, assessment: "Integrate land loop correctness." },
    issue: 93,
    closes: true,
    deps: [],
    mission:
      "Fix `spine integrate` reporting merge conflict when manual `git merge` fast-forwards cleanly (batch 20260702T071449). Closes #93.",
    fileScope: [
      "src/batch/integrate.mjs",
      "src/batch/rules-manifest-drift.mjs",
      "tests/batch/integrate-fast-forward.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/integrate-fast-forward.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Reproduce",
        items: ["Fixture from batch 20260702T071449 orch branch fast-forward"],
      },
      {
        title: "Merge path fix",
        items: ["Detect fast-forward capable state before failing", "Fix rules-manifest drift false conflict"],
      },
      {
        title: "Regression test",
        items: ["integrate succeeds on clean FF scenario"],
      },
    ],
    docsMust: [],
  },
  // --- Enhancement 5 ---
  {
    id: "SP-440",
    slug: "supervisor-spawn-mvp",
    name: "Supervisor spawn MVP",
    size: "M",
    review: { level: 2, label: "Plan + Code", score: 5, assessment: "New batch subprocess; opt-in config." },
    issue: 71,
    closes: false,
    deps: [],
    mission:
      "FR-SHIP-11 Tier 1 (#71 slice A–E): opt-in `agents.supervisor.enabled`, spawn supervisor Pi session on detached batch start, poll reconcile on interval, journal supervisor.started/observation/stopped/nudge events, kill on batch terminal. Default enabled:false.",
    fileScope: [
      "src/batch/supervisor-spawn.mjs",
      "src/batch/detached-start.mjs",
      "src/batch/lifecycle.mjs",
      "templates/agents/supervisor.md",
      "tests/batch/supervisor-spawn.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/supervisor-spawn.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Spawn lifecycle",
        items: [
          "Create supervisor-spawn.mjs (spawn/kill, journal events)",
          "Wire into detached batch start behind enabled flag",
        ],
      },
      {
        title: "Agent template",
        items: ["Update templates/agents/supervisor.md with poll-loop standing orders"],
      },
      {
        title: "Tests",
        items: ["enabled:true → supervisor.started; terminal → supervisor.stopped", "enabled:false → no events"],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — supervisor opt-in (interim)"],
  },
  // --- Bugs batch 6 ---
  {
    id: "SP-441",
    slug: "batch-complete-stale-state",
    name: "Batch complete stale batch-state fix",
    size: "M",
    review: { level: 2, label: "Plan + Code", score: 5, assessment: "Batch state machine correctness." },
    issue: 94,
    closes: true,
    deps: [],
    mission:
      "When `spine batch complete` archives a batch and a new batch starts immediately, batch-state must point at the active batch — not stale completed ID. `spine watch`/`spine status` show active batch. Closes #94.",
    fileScope: [
      "src/batch/batch-state-io.mjs",
      "src/batch/lifecycle.mjs",
      "src/cli/batch-complete.mjs",
      "tests/batch/batch-state-handoff.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/batch-state-handoff.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "State handoff",
        items: [
          "batch start refuses or updates when prior complete left stale pointer",
          "Atomic transition complete → start",
        ],
      },
      {
        title: "Regression",
        items: ["Reproduce 073511 vs 073937 timeline"],
      },
    ],
    docsMust: [],
  },
  {
    id: "SP-442",
    slug: "skip-clears-failed-segment",
    name: "Skip clears failed segment for wave merge",
    size: "M",
    review: { level: 2, label: "Plan + Code", score: 5, assessment: "Skip/retry merge semantics." },
    issue: 96,
    closes: true,
    deps: ["SP-401-merge-blocked-resume-recovery"],
    mission:
      "After `spine batch skip`, clear failed segment classifications so batch can proceed to merge/gate when all tasks terminal — not stuck needs_retry. Closes #96.",
    fileScope: [
      "src/batch/skip-task.mjs",
      "src/batch/reconcile.mjs",
      "tests/batch/skip-clears-failed.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/skip-clears-failed.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Skip semantics",
        items: [
          "Mark skipped tasks terminal without failed segment residue",
          "Reconcile allTasksTerminalSuccess without needs_retry trap",
        ],
      },
      {
        title: "Regression",
        items: ["Fixture: skip after false failure → resume/merge proceeds"],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — skip vs retry"],
  },
  {
    id: "SP-443",
    slug: "isolated-integrate-sync-base",
    name: "Isolated integrate sync-base and doctor",
    size: "M",
    review: { level: 2, label: "Plan + Code", score: 5, assessment: "Completes #91 operator surfaces." },
    issue: 91,
    closes: true,
    deps: ["SP-436-isolated-integrate-core"],
    mission:
      "Complete #91: `spine sync-base` (or documented workflow), human_base_diverged diagnosis, doctor concurrent-dev warnings, integrate config defaults (`integrate.isolatedWorktree`, `allowHumanOnBaseBranch`). Closes #91.",
    fileScope: [
      "src/batch/integrate.mjs",
      "src/batch/reconcile.mjs",
      "src/config/spine-preflight-lib.mjs",
      "src/cli/sync-base.mjs",
      "templates/spine-config.json",
      "tests/batch/integrate-sync-base.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/integrate-sync-base.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Config + doctor",
        items: ["Add integrate.* config defaults", "Doctor warns active batch + human on baseBranch"],
      },
      {
        title: "sync-base + diagnosis",
        items: ["Implement sync-base CLI", "Add human_base_diverged + integrate_isolated_ok diagnoses"],
      },
      {
        title: "Runbook",
        items: ["Document concurrent development §4 + sync-base workflow", "Close #91"],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — FR-WT-08 concurrent development"],
  },
  // --- Enhancement 6 (supervisor config) ---
  {
    id: "SP-444",
    slug: "supervisor-config-doctor-docs",
    name: "Supervisor config doctor and docs",
    size: "S",
    review: { level: 1, label: "Plan Only", score: 3, assessment: "Config wiring + docs; completes #71." },
    issue: 71,
    closes: true,
    deps: ["SP-440-supervisor-spawn-mvp"],
    mission:
      "Wire `agents.supervisor.enabled`, `pollIntervalMs`, `autoNudge` into settings/doctor; update runbook §Supervisor deferred → opt-in supervisor. Closes #71.",
    fileScope: [
      "src/config/settings-fields.mjs",
      "src/doctor/supervisor.mjs",
      "templates/spine-config.json",
      "docs/adoption/operator-runbook.md",
      "tests/doctor/supervisor-config.test.mjs",
    ],
    contract: {
      testCommand:
        "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/doctor/supervisor-config.test.mjs && npm run coverage:check",
      minLineCoverage: 77,
    },
    steps: [
      {
        title: "Settings + doctor",
        items: ["Add editable supervisor fields", "Doctor warns enabled + missing template or bad model"],
      },
      {
        title: "Docs + close",
        items: ["Update runbook supervisor section", "Close #71"],
      },
    ],
    docsMust: ["`docs/adoption/operator-runbook.md` — supervisor opt-in"],
  },
];

function scoreLine(review) {
  return `**Score:** ${review.score}/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1`;
}

function buildPrompt(t) {
  const closesLine = t.closes
    ? `\n**Closes:** [#${t.issue}](https://github.com/beettlle/pi-spine/issues/${t.issue})`
    : `\n**GitHub:** [#${t.issue}](https://github.com/beettlle/pi-spine/issues/${t.issue}) (partial)`;

  const depsBlock =
    t.deps.length === 0
      ? "- **None**"
      : t.deps.map((d) => `- **Task:** ${d.split("-").slice(0, 2).join("-")} (${d.replace(/^[A-Z]+-\d+-/, "")})`).join("\n");

  const contractRows = Object.entries(t.contract)
    .map(([k, v]) => `| ${k} | ${typeof v === "number" ? v : `\`${v}\``} |`)
    .join("\n");

  const implSteps = t.steps
    .map((s, i) => {
      const items = s.items.map((item) => `- [ ] ${item}`).join("\n");
      return `### Step ${i}: ${s.title}\n\n${items}`;
    })
    .join("\n\n");

  const testStepNum = t.steps.length;
  const docStepNum = testStepNum + 1;

  const coverageCheckbox =
    t.contract.testCommand === "true"
      ? ""
      : "- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage";

  const docsMust =
    t.docsMust.length > 0
      ? t.docsMust.map((d) => `- ${d}`).join("\n")
      : "- None beyond File Scope";

  return `# Task: ${t.id} — ${t.name}

**Created:** ${DATE}
**Size:** ${t.size}

## Review Level: ${t.review.level} (${t.review.label})

**Assessment:** ${t.review.assessment}
${scoreLine(t.review)}

## Mission

${t.mission}${closesLine}

## Dependencies

${depsBlock}

## Context to Read First

- GitHub issue #${t.issue}
- \`spine-tasks/CONTEXT.md\` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

${t.fileScope.map((f) => `- \`${f}\``).join("\n")}

## Contract

| Field | Value |
|-------|-------|
${contractRows}

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #${t.issue} acceptance criteria
- [ ] Confirm dependencies satisfied

${implSteps}

### Step ${testStepNum}: Testing & Verification

- [ ] Run FULL test suite: \`npm run typecheck && SPINE_WORKER_STUB=1 npm test\`
${coverageCheckbox}
- [ ] Fix all failures

### Step ${docStepNum}: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] ${t.closes ? `Close GitHub issue #${t.issue} (\`gh issue close ${t.issue}\`)` : "Update linked GitHub issue with progress"}
- [ ] Create \`.DONE\`

## Documentation Requirements

**Must Update:**
${docsMust}

**Check If Affected:**
- \`spine-tasks/CONTEXT.md\` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
${t.closes ? `- [ ] Issue #${t.issue} closed` : ""}

## Git Commit Convention

- \`feat(${t.id}): complete Step N — description\`
- \`fix(${t.id}): description\`
- \`hydrate: ${t.id} expand Step N checkboxes\`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban \`spine-tasks/**\` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
`;
}

function buildStatus(t) {
  const testStepNum = t.steps.length;
  const docStepNum = testStepNum + 1;

  const stepBlocks = [
    `### Step 0: Preflight\n**Status:** ⬜ Not Started\n\n- [ ] Read issue #${t.issue}\n- [ ] Dependencies satisfied`,
    ...t.steps.map(
      (s, i) =>
        `### Step ${i}: ${s.title}\n**Status:** ⬜ Not Started\n\n${s.items.map((item) => `- [ ] ${item}`).join("\n")}`,
    ),
    `### Step ${testStepNum}: Testing & Verification\n**Status:** ⬜ Not Started\n\n- [ ] FULL test suite passing\n- [ ] Coverage gate (if applicable)\n- [ ] All failures fixed`,
    `### Step ${docStepNum}: Documentation & Delivery\n**Status:** ⬜ Not Started\n\n- [ ] Docs updated\n- [ ] Issue ${t.closes ? "closed" : "updated"}\n- [ ] .DONE created`,
  ].join("\n\n---\n\n");

  return `# ${t.id}: ${t.name} — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** ${DATE}
**Review Level:** ${t.review.level}
**Review Counter:** 0
**Iteration:** 0
**Size:** ${t.size}

---

${stepBlocks}

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| ${DATE} | Task staged | PROMPT.md and STATUS.md created (#${t.issue}) |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
`;
}

const depsJson = {};

for (const t of TASKS) {
  const dir = join(TASKS_ROOT, `${t.id}-${t.slug}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "PROMPT.md"), buildPrompt(t));
  writeFileSync(join(dir, "STATUS.md"), buildStatus(t));
  depsJson[`${t.id}-${t.slug}`] = t.deps;
  console.log(`Created ${dir}`);
}

// Merge into dependencies.json
import { readFileSync } from "node:fs";
const depPath = join(TASKS_ROOT, "dependencies.json");
const existing = JSON.parse(readFileSync(depPath, "utf8"));
existing.source = "github-issues-71-96-phase52-2026-07-02";
existing.generatedAt = new Date().toISOString();
for (const [k, v] of Object.entries(depsJson)) {
  existing.tasks[k] = v;
}
writeFileSync(depPath, JSON.stringify(existing, null, 2) + "\n");
console.log(`Updated ${depPath} with ${Object.keys(depsJson).length} tasks`);
console.log(`Next Task ID: SP-445`);
