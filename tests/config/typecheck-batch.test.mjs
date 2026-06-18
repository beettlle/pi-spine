import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

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
