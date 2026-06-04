import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";

import {
	buildRulesManifestDoctorCheck,
	evaluateRulesManifestState,
	fingerprintRulesManifest,
	RULES_MANIFEST_MISSING,
	RULES_MANIFEST_STALE,
} from "../../src/doctor/rules-manifest.mjs";
import { RULES_MANIFEST_REL_PATH } from "../../src/config/cursor-rules/discover.mjs";

test("fingerprintRulesManifest ignores generatedAt", () => {
	const left = {
		generatedAt: "2026-01-01T00:00:00.000Z",
		rulesRoot: ".cursor/rules",
		rules: [
			{
				relPath: "a.mdc",
				spineClass: "always",
				alwaysApply: true,
				description: null,
				globs: [],
				parseStatus: "ok",
			},
		],
		excluded: [],
	};
	const right = { ...left, generatedAt: "2026-06-04T00:00:00.000Z" };
	assert.equal(fingerprintRulesManifest(left), fingerprintRulesManifest(right));
});

test("buildRulesManifestDoctorCheck warns when manifest missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "doctor-rules-missing-"));
	try {
		fs.mkdirSync(path.join(root, ".cursor", "rules"), { recursive: true });
		const check = buildRulesManifestDoctorCheck(root);
		assert.equal(check.warning, true);
		assert.equal(check.code, RULES_MANIFEST_MISSING);
		assert.equal(check.suggestedCommand, "spine rules sync");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildRulesManifestDoctorCheck warns when manifest stale", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "doctor-rules-stale-"));
	try {
		const rulesRoot = path.join(root, ".cursor", "rules");
		fs.mkdirSync(rulesRoot, { recursive: true });
		fs.writeFileSync(path.join(rulesRoot, "live.mdc"), "---\nalwaysApply: true\n---\n", "utf-8");

		const committed = {
			generatedAt: new Date().toISOString(),
			rulesRoot: ".cursor/rules",
			rules: [],
			excluded: [],
		};
		fs.mkdirSync(path.join(root, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(root, RULES_MANIFEST_REL_PATH),
			`${JSON.stringify(committed, null, 2)}\n`,
			"utf-8",
		);

		const state = evaluateRulesManifestState(root);
		assert.equal(state.stale, true);

		const check = buildRulesManifestDoctorCheck(root);
		assert.equal(check.warning, true);
		assert.equal(check.code, RULES_MANIFEST_STALE);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
