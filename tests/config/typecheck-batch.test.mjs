import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Batch hot-path modules guarded by tsconfig.batch.json (SP-275). */
const BATCH_HOT_PATHS = [
	"src/batch/engine.mjs",
	"src/batch/worker-host.mjs",
	"src/batch/worktree.mjs",
	"src/config/spine-config-load.mjs",
];

test("tsconfig.batch.json scopes checkJs hot paths", () => {
	const configPath = path.join(REPO_ROOT, "tsconfig.batch.json");
	const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	const include = config.include ?? [];

	for (const relativePath of BATCH_HOT_PATHS) {
		assert.ok(
			include.includes(relativePath),
			`expected tsconfig.batch.json include to list ${relativePath}`,
		);
		assert.ok(
			fs.existsSync(path.join(REPO_ROOT, relativePath)),
			`expected hot-path module on disk: ${relativePath}`,
		);
		const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
		assert.match(
			source,
			/^\/\/ @ts-check/m,
			`expected per-file // @ts-check in ${relativePath}`,
		);
	}
});

test("npm run typecheck validates extensions and batch hot paths", () => {
	const result = spawnSync("npm", ["run", "typecheck"], {
		cwd: REPO_ROOT,
		encoding: "utf-8",
		env: { ...process.env, FORCE_COLOR: "0" },
	});

	assert.equal(
		result.status,
		0,
		`typecheck failed (exit ${result.status ?? "unknown"}):\n${result.stdout}\n${result.stderr}`,
	);
});
