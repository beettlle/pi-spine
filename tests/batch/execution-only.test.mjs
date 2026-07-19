import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { startBatch } from "../../src/batch/engine.mjs";
import { parsePrompt, validatePrompt } from "../../src/tasks/packet/parse-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("parsePrompt handles Type: execute", () => {
	const markdown = `# Task: TP-111 — Execute
**Size:** M
**Type:** execute

## Mission
Do a thing.

## Dependencies
**None**

## File Scope
- \`test.txt\`

## Steps
### Step 1: Run it

## Contract
| Field | Value |
|-------|-------|
| runCommand | \`echo "hello" > test.txt\` |
| testCommand | \`cat test.txt\` |

## Testing
Run the things.

## Completion Criteria
- [ ] Done
## Do NOT
- Nothing
`;
	const parsed = parsePrompt(markdown);
	assert.equal(parsed.type, "execute");
	
	const valid = validatePrompt(markdown);
	assert.equal(valid.ok, true, valid.errors.join(", "));
});

test("Execution-only task runs without LLM worker and produces .DONE", async () => {
	const projectRoot = await initGitRepo("spine-exec-only-");
	try {
		const taskId = "TP-112";
		const folder = path.join(projectRoot, "spine-tasks", `${taskId}-exec`);
		fs.mkdirSync(folder, { recursive: true });

		// We need an execution-only prompt that edits the file scope
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			`# Task: ${taskId} — Exec
**Size:** S
**Type:** execute

## Mission
Generate a file.

## Dependencies
**None**

## File Scope
- \`src/output.txt\`

## Steps
### Step 1: Go

## Contract
| Field | Value |
|-------|-------|
| runCommand | \`mkdir -p src && echo "success" > src/output.txt\` |
| fileScopeMustChange | \`src/output.txt\` |
| testCommand | \`grep "success" src/output.txt\` |

## Testing
Test it.
## Completion Criteria
- [ ] Done
## Do NOT
- Fail
`,
			"utf-8",
		);

		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }),
			"utf-8",
		);

		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });

		const configPath = path.join(projectRoot, ".spine", "spine-config.json");
		const existingConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		fs.writeFileSync(configPath, JSON.stringify({
			...existingConfig,
			workerBackend: "agentSession",
			lanes: { ...existingConfig.lanes, maxParallel: 1 },
			integrate: { requireGate: false, enforceCoverageLimit: false }
		}), "utf-8");

		const oldIsWorker = process.env.SPINE_IS_WORKER;
		delete process.env.SPINE_IS_WORKER;

		// Run batch
		const batchResult = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		
		if (oldIsWorker) process.env.SPINE_IS_WORKER = oldIsWorker;

		if (!batchResult.ok) {
			console.error("Batch failed with output:", batchResult.output);
			console.error(batchResult);
		}

		assert.equal(batchResult.ok, true, "batch should succeed");
		assert.equal(batchResult.exitCode, 0);

		// The engine merges to the orchBranch. Let's check the file content in that branch.
		const fileContent = execFileSync("git", ["show", `${batchResult.orchBranch}:src/output.txt`], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		assert.match(fileContent, /success/, "Execution output should exist in the orch branch");

	} finally {
		await destroyGitRepo(projectRoot);
	}
});
