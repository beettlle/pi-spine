import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildAgentTemplateDriftDoctorCheck } from "../../src/doctor/agent-template-drift.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const AGENT_FILES = [{ templateKey: "worker", destName: "worker.md" }];

/**
 * @param {string} templateText
 * @param {string|null} projectText
 */
async function withAgentFixture(templateText, projectText, fn) {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-agent-drift-"));
	try {
		const templatePath = path.join(root, "template-worker.md");
		fs.writeFileSync(templatePath, templateText);
		if (projectText !== null) {
			fs.mkdirSync(path.join(root, ".spine", "agents"), { recursive: true });
			fs.writeFileSync(path.join(root, ".spine", "agents", "worker.md"), projectText);
		}
		return fn(
			buildAgentTemplateDriftDoctorCheck({
				projectRoot: root,
				agentFiles: AGENT_FILES,
				templatePaths: { worker: templatePath },
			}),
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

test("identical agent file is current", async () => {
	await withAgentFixture("# Worker\nbase\n", "# Worker\nbase\n", (check) => {
		assert.equal(check.ok, true);
		assert.equal(check.warning, undefined);
	});
});

test("project overrides appended after the template are allowed (FR-WORK-08)", async () => {
	await withAgentFixture("# Worker\nbase\n", "# Worker\nbase\n\n## Project additions\nlocal rule\n", (check) => {
		assert.equal(check.warning, undefined);
	});
});

test("CRLF line endings do not count as drift", async () => {
	await withAgentFixture("# Worker\nbase\n", "# Worker\r\nbase\r\n", (check) => {
		assert.equal(check.warning, undefined);
	});
});

test("stale project copy warns with the drifted path", async () => {
	await withAgentFixture("# Worker\nnew rule\n", "# Worker\nold rule\n", (check) => {
		assert.equal(check.ok, true);
		assert.equal(check.warning, true);
		assert.match(check.detail, /\.spine\/agents\/worker\.md/);
		assert.match(check.suggestedCommand ?? "", /diff templates\/agents/);
	});
});

test("missing project copy is skipped (the exists check reports it)", async () => {
	await withAgentFixture("# Worker\n", null, (check) => {
		assert.equal(check.warning, undefined);
		assert.match(check.detail, /no agent files/);
	});
});

test("pi-spine's own agent prompts start with the packaged templates", () => {
	const check = buildAgentTemplateDriftDoctorCheck({ projectRoot: PACKAGE_ROOT });
	assert.equal(check.warning, undefined, check.detail);
});
