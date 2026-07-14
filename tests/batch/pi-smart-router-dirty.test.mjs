import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	GITIGNORED_ARTIFACT_MARKERS,
	isGitignoredArtifactPath,
	listGitignoredArtifactRoots,
	sanitizeGitignoredArtifactsBeforeLaneCommit,
} from "../../src/batch/lane-dirty-check.mjs";
import { GITIGNORED_ARTIFACT_MARKERS as commitMarkers } from "../../src/batch/lane-dirty-check-commit.mjs";
import { gitPorcelain } from "../../src/batch/lane-commit.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

test("GITIGNORED_ARTIFACT_MARKERS include .pi-smart-router in both modules", () => {
	assert.ok(GITIGNORED_ARTIFACT_MARKERS.includes("/.pi-smart-router/"));
	assert.ok(GITIGNORED_ARTIFACT_MARKERS.includes(".pi-smart-router/"));
	assert.ok(commitMarkers.includes("/.pi-smart-router/"));
	assert.ok(commitMarkers.includes(".pi-smart-router/"));
	assert.deepEqual(
		GITIGNORED_ARTIFACT_MARKERS.filter((m) => m.includes("pi-smart-router")),
		commitMarkers.filter((m) => m.includes("pi-smart-router")),
	);
});

test("isGitignoredArtifactPath matches .pi-smart-router shm/wal/state paths", () => {
	assert.equal(isGitignoredArtifactPath(".pi-smart-router/state.db-shm"), true);
	assert.equal(isGitignoredArtifactPath(".pi-smart-router/state.db-wal"), true);
	assert.equal(isGitignoredArtifactPath(".pi-smart-router/state.db"), true);
	assert.equal(isGitignoredArtifactPath("src/batch/lane-dirty-check.mjs"), false);
});

test("listGitignoredArtifactRoots deduplicates nested .pi-smart-router paths", () => {
	const roots = listGitignoredArtifactRoots([
		".pi-smart-router/state.db-shm",
		".pi-smart-router/state.db-wal",
		".pi-smart-router/state.db",
	]);
	assert.deepEqual(roots, [".pi-smart-router"]);
});

test("sanitizeGitignoredArtifactsBeforeLaneCommit removes worktree-only .pi-smart-router files", async () => {
	const projectRoot = await initGitRepo("spine-gitignored-clean-pi-smart-router-");
	try {
		fs.writeFileSync(path.join(projectRoot, ".gitignore"), ".pi-smart-router/\n", "utf-8");
		execCommit(projectRoot, "gitignore pi-smart-router");

		const routerDir = path.join(projectRoot, ".pi-smart-router");
		fs.mkdirSync(routerDir, { recursive: true });
		fs.writeFileSync(path.join(routerDir, "state.db"), "db\n", "utf-8");
		fs.writeFileSync(path.join(routerDir, "state.db-shm"), "shm\n", "utf-8");
		fs.writeFileSync(path.join(routerDir, "state.db-wal"), "wal\n", "utf-8");

		const { cleanedRoots } = sanitizeGitignoredArtifactsBeforeLaneCommit(projectRoot, {
			porcelain: gitPorcelain(projectRoot),
		});
		assert.deepEqual(cleanedRoots, [".pi-smart-router"]);
		assert.equal(gitPorcelain(projectRoot), "");
		assert.equal(fs.existsSync(path.join(routerDir, "state.db-shm")), false);
		assert.equal(fs.existsSync(path.join(routerDir, "state.db-wal")), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
