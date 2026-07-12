/**
 * SP-631 — gate posture approval streak counters (FR-REL250-09 / #123).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	GATE_POSTURE_STREAK_REL,
	GATE_POSTURE_STREAK_VERSION,
	gatePostureStreakPath,
	getCategoryStreak,
	getKindStreak,
	incrementCategoryStreak,
	incrementKindStreak,
	loadGatePostureStreaks,
	readCategoryStreakThreshold,
	resetAllStreaks,
	resetCategoryStreak,
	resetKindStreak,
	streakMeetsThreshold,
} from "../../src/batch/gate-posture-streak.mjs";
import { GATE_CATEGORIES } from "../../src/batch/gate-posture-defaults.mjs";

/**
 * @returns {Promise<string>}
 */
async function tempRoot() {
	return mkdtemp(path.join(os.tmpdir(), "spine-streak-"));
}

/**
 * @param {string} root
 */
async function cleanup(root) {
	await rm(root, { recursive: true, force: true });
}

test("gatePostureStreakPath resolves under .spine/runtime/gate-posture", () => {
	const root = "/tmp/project";
	assert.equal(
		gatePostureStreakPath(root),
		path.join(root, GATE_POSTURE_STREAK_REL),
	);
	assert.ok(GATE_POSTURE_STREAK_REL.includes(path.join(".spine", "runtime")));
});

test("loadGatePostureStreaks returns zeros when file is missing", async () => {
	const root = await tempRoot();
	try {
		const state = loadGatePostureStreaks(root);
		assert.equal(state.version, GATE_POSTURE_STREAK_VERSION);
		for (const category of GATE_CATEGORIES) {
			assert.equal(state.categories[category], 0);
		}
		assert.deepEqual(state.kinds, {});
		assert.equal(getCategoryStreak(root, "write"), 0);
		assert.equal(getKindStreak(root, "integrate"), 0);
	} finally {
		await cleanup(root);
	}
});

test("incrementCategoryStreak persists consecutive approvals atomically", async () => {
	const root = await tempRoot();
	try {
		assert.equal(incrementCategoryStreak(root, "write"), 1);
		assert.equal(incrementCategoryStreak(root, "write"), 2);
		assert.equal(incrementCategoryStreak(root, "write"), 3);
		assert.equal(getCategoryStreak(root, "write"), 3);
		assert.equal(getCategoryStreak(root, "read"), 0);

		const filePath = gatePostureStreakPath(root);
		assert.ok(fs.existsSync(filePath));
		const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		assert.equal(raw.version, GATE_POSTURE_STREAK_VERSION);
		assert.equal(raw.categories.write, 3);
		assert.ok(typeof raw.updatedAt === "string");
	} finally {
		await cleanup(root);
	}
});

test("incrementKindStreak tracks per gate kind independently", async () => {
	const root = await tempRoot();
	try {
		assert.equal(incrementKindStreak(root, "integrate"), 1);
		assert.equal(incrementKindStreak(root, "integrate"), 2);
		assert.equal(incrementKindStreak(root, "release"), 1);
		assert.equal(getKindStreak(root, "integrate"), 2);
		assert.equal(getKindStreak(root, "release"), 1);
		assert.equal(getCategoryStreak(root, "execute"), 0);
	} finally {
		await cleanup(root);
	}
});

test("resetCategoryStreak clears count on reject / manual break", async () => {
	const root = await tempRoot();
	try {
		incrementCategoryStreak(root, "network");
		incrementCategoryStreak(root, "network");
		incrementCategoryStreak(root, "write");
		assert.equal(resetCategoryStreak(root, "network"), 0);
		assert.equal(getCategoryStreak(root, "network"), 0);
		assert.equal(getCategoryStreak(root, "write"), 1);
	} finally {
		await cleanup(root);
	}
});

test("resetKindStreak clears kind count on reject / manual break", async () => {
	const root = await tempRoot();
	try {
		incrementKindStreak(root, "integrate");
		incrementKindStreak(root, "integrate");
		assert.equal(resetKindStreak(root, "integrate"), 0);
		assert.equal(getKindStreak(root, "integrate"), 0);
	} finally {
		await cleanup(root);
	}
});

test("resetAllStreaks clears categories and kinds", async () => {
	const root = await tempRoot();
	try {
		incrementCategoryStreak(root, "execute");
		incrementKindStreak(root, "integrate");
		const cleared = resetAllStreaks(root);
		assert.equal(cleared.categories.execute, 0);
		assert.deepEqual(cleared.kinds, {});
		assert.equal(getCategoryStreak(root, "execute"), 0);
		assert.equal(getKindStreak(root, "integrate"), 0);
	} finally {
		await cleanup(root);
	}
});

test("streakMeetsThreshold reads autoApproveAfterN correctly", () => {
	assert.equal(streakMeetsThreshold(0, 0), true);
	assert.equal(streakMeetsThreshold(2, 3), false);
	assert.equal(streakMeetsThreshold(3, 3), true);
	assert.equal(streakMeetsThreshold(5, 3), true);
	assert.equal(streakMeetsThreshold(10, null), false);
	assert.equal(streakMeetsThreshold(10, undefined), false);
	assert.equal(streakMeetsThreshold(10, -1), false);
	assert.equal(streakMeetsThreshold(-1, 3), false);
	assert.equal(streakMeetsThreshold(1.5, 3), false);
});

test("readCategoryStreakThreshold combines load and threshold check", async () => {
	const root = await tempRoot();
	try {
		assert.deepEqual(readCategoryStreakThreshold(root, "write", 3), {
			count: 0,
			meetsThreshold: false,
		});
		incrementCategoryStreak(root, "write");
		incrementCategoryStreak(root, "write");
		assert.deepEqual(readCategoryStreakThreshold(root, "write", 3), {
			count: 2,
			meetsThreshold: false,
		});
		incrementCategoryStreak(root, "write");
		assert.deepEqual(readCategoryStreakThreshold(root, "write", 3), {
			count: 3,
			meetsThreshold: true,
		});
		assert.deepEqual(readCategoryStreakThreshold(root, "read", 0), {
			count: 0,
			meetsThreshold: true,
		});
	} finally {
		await cleanup(root);
	}
});

test("corrupt streak file fails closed to zero counts", async () => {
	const root = await tempRoot();
	try {
		const filePath = gatePostureStreakPath(root);
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		fs.writeFileSync(filePath, "{not-json", "utf-8");
		assert.equal(getCategoryStreak(root, "write"), 0);
		assert.equal(readCategoryStreakThreshold(root, "write", 3).meetsThreshold, false);
	} finally {
		await cleanup(root);
	}
});

test("category streaks survive reload and do not leak across categories", async () => {
	const root = await tempRoot();
	try {
		incrementCategoryStreak(root, "write");
		incrementCategoryStreak(root, "execute");
		incrementCategoryStreak(root, "execute");
		const reloaded = loadGatePostureStreaks(root);
		assert.equal(reloaded.categories.write, 1);
		assert.equal(reloaded.categories.execute, 2);
		assert.equal(reloaded.categories.network, 0);
	} finally {
		await cleanup(root);
	}
});
