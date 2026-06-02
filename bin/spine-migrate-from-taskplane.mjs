import fs from "node:fs";
import path from "node:path";
import { validateSpineConfig } from "./spine-config.mjs";
import {
	DEFAULT_TASKPLANE_SOURCE_PATH,
	loadTaskplaneConfig,
	mapTaskplaneToSpine,
} from "../src/migrate/taskplane-config.mjs";

export function parseMigrateArgs(args) {
	const dryRun = args.includes("--dry-run");
	const force = args.includes("--force");
	const json = args.includes("--json");

	const sourceIdx = args.indexOf("--source");
	const sourceRaw = sourceIdx !== -1 ? args[sourceIdx + 1] : null;
	if (sourceRaw?.startsWith("--")) {
		throw new Error("Missing value for --source <path>.");
	}

	const source = sourceRaw ?? DEFAULT_TASKPLANE_SOURCE_PATH;

	return { dryRun, force, json, source };
}

export function runMigrateFromTaskplane(projectRoot, args = []) {
	let parsed;
	try {
		parsed = parseMigrateArgs(args);
	} catch (err) {
		return {
			ok: false,
			error: err.message,
			suggestedCommand: "spine migrate-from-taskplane --source .pi/taskplane-config.json",
			exitCode: 1,
		};
	}

	const { dryRun, force, source } = parsed;
	const sourcePath = path.isAbsolute(source) ? source : path.join(projectRoot, source);
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");

	let taskplaneConfig;
	try {
		taskplaneConfig = loadTaskplaneConfig(sourcePath);
	} catch (err) {
		return {
			ok: false,
			error: err.message,
			suggestedCommand: "spine init --preset taskplane-compat",
			exitCode: 1,
		};
	}

	const config = mapTaskplaneToSpine(taskplaneConfig);
	const validationError = validateSpineConfig(config);
	if (validationError) {
		return {
			ok: false,
			error: validationError.message,
			suggestedCommand: validationError.suggestedCommand,
			exitCode: 1,
		};
	}

	if (fs.existsSync(configPath) && !force && !dryRun) {
		return {
			ok: false,
			error: "Project already has .spine/spine-config.json. Use --force to overwrite.",
			suggestedCommand: "spine migrate-from-taskplane --force",
			exitCode: 1,
		};
	}

	let action = "dry-run";
	if (!dryRun) {
		const existed = fs.existsSync(configPath);
		fs.mkdirSync(path.dirname(configPath), { recursive: true });
		fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
		action = existed && force ? "overwrite" : "create";
	}

	return {
		ok: true,
		dryRun,
		force,
		source: sourcePath,
		configPath,
		config,
		action,
		exitCode: 0,
	};
}

export function cmdMigrateFromTaskplane(args = []) {
	const projectRoot = process.cwd();
	const result = runMigrateFromTaskplane(projectRoot, args);

	if (!result.ok) {
		console.error(`❌ ${result.error}`);
		if (result.suggestedCommand) {
			console.error(`   → Run: ${result.suggestedCommand}`);
		}
		process.exit(result.exitCode ?? 1);
	}

	if (args.includes("--json")) {
		console.log(
			JSON.stringify(
				{
					ok: true,
					dryRun: result.dryRun,
					source: result.source,
					configPath: result.configPath,
					action: result.action,
					config: result.config,
				},
				null,
				2,
			),
		);
		return;
	}

	console.log("\npi-spine Migrate from Taskplane\n");
	if (result.dryRun) {
		console.log("  Dry run — no files will be written.\n");
		console.log(JSON.stringify(result.config, null, 2));
		console.log();
		return;
	}

	console.log(`  ${result.action}  .spine/spine-config.json`);
	console.log(`  source  ${path.relative(projectRoot, result.source)}`);
	console.log("\n✅ Taskplane config migrated.\n");
}
