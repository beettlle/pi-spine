import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSpineConfig } from "./spine-config.mjs";
import { discoverCursorRules } from "../src/config/cursor-rules/discover.mjs";
import { RULES_PROFILE_REL_PATH } from "../src/config/cursor-rules/profile.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PACKAGE_ROOT = path.resolve(__dirname, "..");

export const TEMPLATE_PATHS = {
	spineConfig: path.join(PACKAGE_ROOT, "templates", "spine-config.json"),
	rulesProfile: path.join(PACKAGE_ROOT, "templates", "rules-profile.json"),
	tasksContext: path.join(PACKAGE_ROOT, "templates", "tasks", "CONTEXT.md"),
	agents: {
		worker: path.join(PACKAGE_ROOT, "templates", "agents", "worker.md"),
		reviewer: path.join(PACKAGE_ROOT, "templates", "agents", "reviewer.md"),
		supervisor: path.join(PACKAGE_ROOT, "templates", "agents", "supervisor.md"),
	},
};

export const DEFAULT_NEXT_TASK_ID = "SP-001";

export const AGENT_STUB_FILES = [
	{ templateKey: "worker", destName: "worker.md" },
	{ templateKey: "reviewer", destName: "reviewer.md" },
	{ templateKey: "supervisor", destName: "supervisor.md" },
];

export const DEFAULT_TASKS_ROOT = "spine-tasks";
export const TASKPLANE_COMPAT_TASKS_ROOT = "taskplane-tasks";
/** @deprecated Use plain `spine init`; kept for Taskplane migrants. */
export const TASKPLANE_COMPAT_PRESET = "taskplane-compat";
export const LEGACY_TASKPLANE_PRESET_ALIASES = [TASKPLANE_COMPAT_PRESET];

export const SPINE_INIT_TESTING_COMMAND = "npm run typecheck && npm test";
export const SPINE_INIT_COVERAGE_COMMAND = "npm run coverage:check";

export const SPINE_GITIGNORE_ENTRIES = [
	".spine/runtime/",
	".spine/batch-state.json",
	".spine/batch-history.json",
	".worktrees/",
];

const SPINE_GITIGNORE_HEADER = "# pi-spine runtime";

export function getTemplatePaths() {
	for (const templatePath of [
		TEMPLATE_PATHS.spineConfig,
		TEMPLATE_PATHS.rulesProfile,
		TEMPLATE_PATHS.tasksContext,
		...Object.values(TEMPLATE_PATHS.agents),
	]) {
		if (!fs.existsSync(templatePath)) {
			throw new Error(`Missing init template: ${templatePath}`);
		}
	}
	return TEMPLATE_PATHS;
}

export function loadSpineConfigTemplate() {
	const templatePath = getTemplatePaths().spineConfig;
	return JSON.parse(fs.readFileSync(templatePath, "utf-8"));
}

export function loadRulesProfileTemplate() {
	const templatePath = getTemplatePaths().rulesProfile;
	return fs.readFileSync(templatePath, "utf-8");
}

export function loadTasksContextTemplate() {
	const templatePath = getTemplatePaths().tasksContext;
	return fs.readFileSync(templatePath, "utf-8");
}

export function buildContextMd(projectRoot, { nextTaskId = DEFAULT_NEXT_TASK_ID } = {}) {
	const template = loadTasksContextTemplate();
	const projectTitle = path.basename(projectRoot);
	const lastUpdated = new Date().toISOString().slice(0, 10);
	return template
		.replaceAll("{{PROJECT_TITLE}}", projectTitle)
		.replaceAll("{{LAST_UPDATED}}", lastUpdated)
		.replaceAll("{{NEXT_TASK_ID}}", nextTaskId);
}

export function normalizeTasksRoot(tasksRootRaw) {
	if (!tasksRootRaw || tasksRootRaw.startsWith("--")) {
		throw new Error("Missing value for --tasks-root <relative-path>.");
	}
	if (path.isAbsolute(tasksRootRaw)) {
		throw new Error("--tasks-root must be relative to the project root (absolute paths are not allowed).");
	}

	const normalized = tasksRootRaw
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\.\/+/, "")
		.replace(/\/+$/, "");

	if (!normalized || normalized === ".") {
		throw new Error("--tasks-root must not be empty.");
	}
	if (normalized === ".." || normalized.startsWith("../")) {
		throw new Error("--tasks-root must stay within the project root (paths starting with .. are not allowed).");
	}
	return normalized;
}

export function parseInitArgs(args) {
	const force = args.includes("--force");
	const dryRun = args.includes("--dry-run");
	const tasksRootIdx = args.indexOf("--tasks-root");
	const tasksRootRaw = tasksRootIdx !== -1 ? args[tasksRootIdx + 1] : null;
	const presetIdx = args.indexOf("--preset");
	const presetRaw = presetIdx !== -1 ? args[presetIdx + 1] : null;

	if (presetRaw?.startsWith("--")) {
		throw new Error("Missing value for --preset <name>.");
	}
	if (presetRaw && !LEGACY_TASKPLANE_PRESET_ALIASES.includes(presetRaw)) {
		throw new Error(
			`Unknown preset: ${presetRaw}. Supported: ${LEGACY_TASKPLANE_PRESET_ALIASES.join(", ")} (deprecated — use plain spine init).`,
		);
	}

	const preset = presetRaw ?? null;
	let tasksRoot = DEFAULT_TASKS_ROOT;
	if (preset === TASKPLANE_COMPAT_PRESET && !tasksRootRaw) {
		tasksRoot = TASKPLANE_COMPAT_TASKS_ROOT;
	}
	if (tasksRootRaw) {
		tasksRoot = normalizeTasksRoot(tasksRootRaw);
	}

	return { force, dryRun, tasksRoot, preset };
}

/** Apply production-ready defaults for every greenfield init. */
export function applySpineInitDefaults(config) {
	config.testing.build = SPINE_INIT_TESTING_COMMAND;
	config.testing.test = SPINE_INIT_TESTING_COMMAND;
	config.testing.testWithCoverage = SPINE_INIT_COVERAGE_COMMAND;
	config.dashboard = { ...(config.dashboard ?? {}), port: 8109 };
	config.gates = {
		...(config.gates ?? {}),
		requireBeforeIntegrate: true,
		collectBuildEvidence: true,
		collectTestEvidence: true,
	};
	config.lanes = { ...(config.lanes ?? {}), maxParallel: 3, queueExcess: true };
	const standards = Array.isArray(config.standards) ? config.standards : [];
	const neverLoad = Array.isArray(config.neverLoad) ? config.neverLoad : [];
	config.standards = standards.filter((entry) => !neverLoad.includes(entry));
	return config;
}

/** @deprecated Alias for {@link applySpineInitDefaults}. */
export function applyTaskplaneCompatPreset(config) {
	return applySpineInitDefaults(config);
}

export function buildSpineConfig(projectRoot, tasksRoot, { preset } = {}) {
	const template = loadSpineConfigTemplate();
	const config = structuredClone(template);
	config.project.name = path.basename(projectRoot);
	config.paths.tasksRoot = tasksRoot;
	applySpineInitDefaults(config);
	if (preset === TASKPLANE_COMPAT_PRESET) {
		// Preset only affects default tasks root when --tasks-root omitted; config already applied.
		void preset;
	}
	return config;
}

export function ensureGitignoreEntries(projectRoot, { dryRun = false } = {}) {
	const gitignorePath = path.join(projectRoot, ".gitignore");
	const fileExists = fs.existsSync(gitignorePath);
	const existingContent = fileExists ? fs.readFileSync(gitignorePath, "utf-8") : "";
	const existingLines = new Set(existingContent.split(/\r?\n/).map((line) => line.trim()));

	const added = [];
	const skipped = [];

	for (const entry of SPINE_GITIGNORE_ENTRIES) {
		if (existingLines.has(entry)) {
			skipped.push(entry);
		} else {
			added.push(entry);
		}
	}

	if (added.length === 0) {
		return { created: false, added, skipped };
	}

	if (!dryRun) {
		const newLines = [];
		if (!existingLines.has(SPINE_GITIGNORE_HEADER)) {
			newLines.push(SPINE_GITIGNORE_HEADER);
		}
		newLines.push(...added);

		const suffix = newLines.join("\n") + "\n";
		const nextContent = fileExists ? `${existingContent.replace(/\s*$/, "")}\n\n${suffix}` : `${suffix}`;
		fs.mkdirSync(projectRoot, { recursive: true });
		fs.writeFileSync(gitignorePath, nextContent, "utf-8");
	}

	return { created: !fileExists, added, skipped };
}

function writeFileIfAllowed(projectRoot, relativePath, content, { force, dryRun }) {
	const fullPath = path.join(projectRoot, relativePath);
	if (fs.existsSync(fullPath) && !force) {
		return { action: "skip", path: relativePath };
	}
	if (!dryRun) {
		fs.mkdirSync(path.dirname(fullPath), { recursive: true });
		fs.writeFileSync(fullPath, content, "utf-8");
	}
	return { action: fs.existsSync(fullPath) && force ? "overwrite" : "create", path: relativePath };
}

/**
 * @param {string} projectRoot
 * @param {{ dryRun?: boolean, force?: boolean }} [options]
 */
export function runInitRulesDiscover(projectRoot, { dryRun = false, force = false } = {}) {
	if (dryRun) {
		return { ok: true, dryRun: true, skipped: true };
	}

	const profilePath = path.join(projectRoot, RULES_PROFILE_REL_PATH);
	if (!fs.existsSync(profilePath)) {
		return {
			ok: false,
			error: `${RULES_PROFILE_REL_PATH} missing — init should copy templates/rules-profile.json first`,
		};
	}

	const discovered = discoverCursorRules({ projectRoot, writeManifest: true });
	return {
		ok: true,
		manifestPath: discovered.manifestPath,
		ruleCount: discovered.manifest.rules.length,
		excludedCount: discovered.manifest.excluded.length,
		force,
	};
}

export function runInit(projectRoot, args = []) {
	getTemplatePaths();

	let parsed;
	try {
		parsed = parseInitArgs(args);
	} catch (err) {
		return { ok: false, error: err.message, exitCode: 1 };
	}

	const { force, dryRun, tasksRoot, preset } = parsed;
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");

	if (fs.existsSync(configPath) && !force) {
		return {
			ok: false,
			error: "Project already initialized (.spine/spine-config.json exists). Use --force to overwrite.",
			exitCode: 1,
		};
	}

	const config = buildSpineConfig(projectRoot, tasksRoot, { preset });
	const validationError = validateSpineConfig(config);
	if (validationError) {
		return {
			ok: false,
			error: validationError.message,
			exitCode: 1,
		};
	}

	const actions = [];

	const configResult = writeFileIfAllowed(
		projectRoot,
		".spine/spine-config.json",
		`${JSON.stringify(config, null, 2)}\n`,
		{ force, dryRun },
	);
	actions.push(configResult);

	const profileTemplate = loadRulesProfileTemplate();
	const profileResult = writeFileIfAllowed(
		projectRoot,
		RULES_PROFILE_REL_PATH,
		profileTemplate.endsWith("\n") ? profileTemplate : `${profileTemplate}\n`,
		{ force, dryRun },
	);
	actions.push(profileResult);

	for (const { templateKey, destName } of AGENT_STUB_FILES) {
		const templateContent = fs.readFileSync(TEMPLATE_PATHS.agents[templateKey], "utf-8");
		const agentResult = writeFileIfAllowed(
			projectRoot,
			`.spine/agents/${destName}`,
			templateContent,
			{ force, dryRun },
		);
		actions.push(agentResult);
	}

	const tasksRootPath = path.join(projectRoot, tasksRoot);
	if (!dryRun && !fs.existsSync(tasksRootPath)) {
		fs.mkdirSync(tasksRootPath, { recursive: true });
		actions.push({ action: "create", path: `${tasksRoot}/` });
	} else if (dryRun && !fs.existsSync(tasksRootPath)) {
		actions.push({ action: "create", path: `${tasksRoot}/` });
	}

	const contextContent = buildContextMd(projectRoot);
	const contextResult = writeFileIfAllowed(
		projectRoot,
		`${tasksRoot}/CONTEXT.md`,
		contextContent,
		{ force, dryRun },
	);
	actions.push(contextResult);

	const gitignoreResult = ensureGitignoreEntries(projectRoot, { dryRun });
	if (gitignoreResult.added.length > 0) {
		actions.push({
			action: gitignoreResult.created ? "create" : "update",
			path: ".gitignore",
			added: gitignoreResult.added,
		});
	}

	const rulesDiscoverResult = runInitRulesDiscover(projectRoot, { dryRun, force });
	if (!rulesDiscoverResult.ok) {
		return {
			ok: false,
			error: rulesDiscoverResult.error,
			exitCode: 1,
		};
	}
	if (!rulesDiscoverResult.skipped && rulesDiscoverResult.manifestPath) {
		actions.push({
			action: "create",
			path: ".spine/rules-manifest.json",
			ruleCount: rulesDiscoverResult.ruleCount,
		});
	} else if (dryRun && fs.existsSync(path.join(projectRoot, ".cursor", "rules"))) {
		actions.push({ action: "create", path: ".spine/rules-manifest.json" });
	}

	return {
		ok: true,
		dryRun,
		tasksRoot,
		config,
		actions,
		gitignoreResult,
		rulesDiscoverResult,
		exitCode: 0,
	};
}

export function cmdInit(args = []) {
	const projectRoot = process.cwd();
	const result = runInit(projectRoot, args);

	if (!result.ok) {
		console.error(`❌ ${result.error}`);
		process.exit(result.exitCode ?? 1);
	}

	console.log("\npi-spine Init\n");
	if (result.dryRun) {
		console.log("  Dry run — no files will be written.\n");
	}

	for (const action of result.actions) {
		if (action.action === "skip") {
			console.log(`  skip  ${action.path} (already exists)`);
			continue;
		}
		const label = action.action === "update" ? "update" : action.action === "overwrite" ? "overwrite" : "create";
		const detail = action.added?.length ? ` (${action.added.length} entries added)` : "";
		console.log(`  ${label} ${action.path}${detail}`);
	}

	console.log("\n✅ pi-spine initialized.\n");
	console.log("Next: spine doctor\n");
}
