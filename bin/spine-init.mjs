import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSpineConfig } from "./spine-config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PACKAGE_ROOT = path.resolve(__dirname, "..");

export const TEMPLATE_PATHS = {
	spineConfig: path.join(PACKAGE_ROOT, "templates", "spine-config.json"),
	agents: {
		worker: path.join(PACKAGE_ROOT, "templates", "agents", "worker.md"),
		reviewer: path.join(PACKAGE_ROOT, "templates", "agents", "reviewer.md"),
		supervisor: path.join(PACKAGE_ROOT, "templates", "agents", "supervisor.md"),
	},
};

export const AGENT_STUB_FILES = [
	{ templateKey: "worker", destName: "worker.md" },
	{ templateKey: "reviewer", destName: "reviewer.md" },
	{ templateKey: "supervisor", destName: "supervisor.md" },
];

export const DEFAULT_TASKS_ROOT = "spine-tasks";

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

	let tasksRoot = DEFAULT_TASKS_ROOT;
	if (tasksRootRaw) {
		tasksRoot = normalizeTasksRoot(tasksRootRaw);
	}

	return { force, dryRun, tasksRoot };
}

export function buildSpineConfig(projectRoot, tasksRoot) {
	const template = loadSpineConfigTemplate();
	const config = structuredClone(template);
	config.project.name = path.basename(projectRoot);
	config.paths.tasksRoot = tasksRoot;
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

export function runInit(projectRoot, args = []) {
	getTemplatePaths();

	let parsed;
	try {
		parsed = parseInitArgs(args);
	} catch (err) {
		return { ok: false, error: err.message, exitCode: 1 };
	}

	const { force, dryRun, tasksRoot } = parsed;
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");

	if (fs.existsSync(configPath) && !force) {
		return {
			ok: false,
			error: "Project already initialized (.spine/spine-config.json exists). Use --force to overwrite.",
			exitCode: 1,
		};
	}

	const config = buildSpineConfig(projectRoot, tasksRoot);
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

	const gitignoreResult = ensureGitignoreEntries(projectRoot, { dryRun });
	if (gitignoreResult.added.length > 0) {
		actions.push({
			action: gitignoreResult.created ? "create" : "update",
			path: ".gitignore",
			added: gitignoreResult.added,
		});
	}

	return {
		ok: true,
		dryRun,
		tasksRoot,
		config,
		actions,
		gitignoreResult,
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
