import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
	formatTasksValidateHuman,
	runSpineTasksValidate,
} from '../../bin/spine-tasks.mjs';
import { buildPlan } from '../../src/planner/index.mjs';
import { destroyGitRepo, initGitRepo } from '../helpers/git-fixture.mjs';

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'spine.mjs');
const PLAN_CONFIG = { lanes: { maxParallel: 1, queueExcess: true } };

const VALID_CONTRACT_SECTION = `## Contract

| Field | Value |
|-------|-------|
| testCommand | \`npm test\` |
| fileScopeMustChange | \`src/example.mjs\` |
`;

/**
 * @param {string} taskId
 * @param {{ title?: string, fileScope?: string, extraBody?: string }} [options]
 */
function validPromptMarkdown(
	taskId,
	{ title = 'Valid fixture', fileScope = 'src/example.mjs', extraBody = '' } = {},
) {
	return `# Task: ${taskId} — ${title}

## Mission
Smoke validation task.

## Dependencies
- **None**

## File Scope
- \`${fileScope}\`

${VALID_CONTRACT_SECTION}
${extraBody}
## Steps
### Step 0: Work
- [ ] one

### Step 1: Testing & Verification
- [ ] run tests

## Completion Criteria
- [ ] done

## Do NOT
- touch unrelated files
`;
}

/**
 * @param {string} projectRoot
 * @param {string} folderName
 * @param {string} taskId
 * @param {string} promptMarkdown
 */
function writeTask(projectRoot, folderName, taskId, promptMarkdown) {
	const folder = path.join(projectRoot, 'spine-tasks', folderName);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(path.join(folder, 'PROMPT.md'), promptMarkdown, 'utf-8');
}

test('formatTasksValidateHuman prefixes summary before failure details', () => {
	const output = formatTasksValidateHuman({
		totalCount: 2,
		passedCount: 1,
		failedCount: 1,
		failures: [
			{
				taskId: 'FX-002',
				promptPath: '/tmp/FX-002/PROMPT.md',
				errors: ['Missing testing coverage'],
			},
		],
	});

	assert.match(output, /^Validated 2 task\(s\): 1 passed, 1 failed/);
	assert.match(output, /Invalid PROMPT for FX-002/);
	assert.match(output, /Missing testing coverage/);
});

test('runSpineTasksValidate exits 0 for valid PROMPT packets', async () => {
	const projectRoot = await initGitRepo('spine-validate-pass-');
	try {
		writeTask(projectRoot, 'FX-101-valid', 'FX-101', validPromptMarkdown('FX-101'));

		const result = await runSpineTasksValidate({ projectRoot, scope: 'FX-101' });
		assert.equal(result.exitCode, 0);
		assert.match(result.output, /Validated 1 task\(s\): 1 passed, 0 failed/);
		assert.deepEqual(result.failures, []);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('runSpineTasksValidate reports same failure message as planner for invalid PROMPT', async () => {
	const projectRoot = await initGitRepo('spine-validate-fail-');
	const tasksRoot = path.join(projectRoot, 'spine-tasks');
	const invalidPrompt = `# Task: FX-102 — Missing testing

## Mission
x

## Dependencies
- **None**

## File Scope
- \`src/example.mjs\`

## Steps
### Step 0: Work
- [ ] a

## Completion Criteria
- [ ] done

## Do NOT
- n
`;

	try {
		writeTask(projectRoot, 'FX-102-testing', 'FX-102', invalidPrompt);

		let plannerMessage = '';
		assert.throws(
			() => buildPlan({ scope: 'FX-102', config: PLAN_CONFIG, tasksRoot }),
			(err) => {
				plannerMessage = err.message;
				return true;
			},
		);

		const result = await runSpineTasksValidate({ projectRoot, scope: 'FX-102' });
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /Validated 1 task\(s\): 0 passed, 1 failed/);
		assert.match(result.output, /Invalid PROMPT for FX-102/);
		assert.match(result.output, /testing coverage/i);
		assert.ok(result.output.includes('testing coverage'));
		assert.ok(plannerMessage.includes('testing coverage'));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('runSpineTasksValidate returns exit 2 for missing config', async () => {
	const projectRoot = await initGitRepo('spine-validate-config-');
	try {
		fs.rmSync(path.join(projectRoot, '.spine', 'spine-config.json'));

		await assert.rejects(
			() => runSpineTasksValidate({ projectRoot, scope: 'all' }),
			(err) => {
				assert.equal(err.exitCode, 2);
				assert.match(err.message, /spine-config\.json not found/);
				assert.equal(err.suggestedCommand, 'spine init');
				return true;
			},
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('runSpineTasksValidate returns exit 2 for unresolved scope', async () => {
	const projectRoot = await initGitRepo('spine-validate-scope-');
	try {
		await assert.rejects(
			() => runSpineTasksValidate({ projectRoot, scope: 'ZZ-999' }),
			(err) => {
				assert.equal(err.exitCode, 2);
				assert.match(err.message, /Scope did not match any discovered task/);
				return true;
			},
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('spine tasks validate CLI exits 0 for valid scope', async () => {
	const projectRoot = await initGitRepo('spine-validate-cli-pass-');
	try {
		writeTask(projectRoot, 'FX-103-cli', 'FX-103', validPromptMarkdown('FX-103', { title: 'CLI valid' }));

		const result = spawnSync(process.execPath, [SPINE_BIN, 'tasks', 'validate', 'FX-103'], {
			cwd: projectRoot,
			encoding: 'utf-8',
		});

		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /Validated 1 task\(s\): 1 passed, 0 failed/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('spine tasks validate CLI exits 1 for invalid PROMPT', async () => {
	const projectRoot = await initGitRepo('spine-validate-cli-fail-');
	try {
		writeTask(
			projectRoot,
			'FX-104-cli',
			'FX-104',
			`# Task: FX-104 - Bad heading

## Mission
x

## Dependencies
- **None**

## File Scope
- \`src/example.mjs\`

## Steps
### Step 0: Work
- [ ] a

### Step 1: Testing & Verification
- [ ] t

## Completion Criteria
- [ ] done

## Do NOT
- n
`,
		);

		const result = spawnSync(process.execPath, [SPINE_BIN, 'tasks', 'validate', 'FX-104'], {
			cwd: projectRoot,
			encoding: 'utf-8',
		});

		assert.equal(result.status, 1, result.stderr);
		assert.match(result.stdout, /Validated 1 task\(s\): 0 passed, 1 failed/);
		assert.match(result.stdout, /Invalid PROMPT for FX-104/);
		assert.match(result.stdout, /em dash/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('spine tasks validate CLI exits 2 for config error', async () => {
	const projectRoot = await initGitRepo('spine-validate-cli-config-');
	try {
		fs.rmSync(path.join(projectRoot, '.spine', 'spine-config.json'));

		const result = spawnSync(process.execPath, [SPINE_BIN, 'tasks', 'validate', 'all'], {
			cwd: projectRoot,
			encoding: 'utf-8',
		});

		assert.equal(result.status, 2, result.stdout);
		assert.match(result.stderr, /spine-config\.json not found/);
		assert.match(result.stderr, /Suggested: spine init/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
