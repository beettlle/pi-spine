import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { runSpineTasksValidate } from '../../bin/spine-tasks.mjs';
import { destroyGitRepo, initGitRepo } from '../helpers/git-fixture.mjs';

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'spine.mjs');

/**
 * @param {string} taskId
 * @param {string} testCommand
 * @param {"S"|"M"|"L"} [size]
 */
function promptWithNpmTestDashDash(taskId, testCommand, size = 'S') {
	return `# Task: ${taskId} — npm test -- scope fixture

**Size:** ${size}

## Mission
Contract validate npm test -- false scope.

## Dependencies
- **None**

## File Scope
- \`src/example.mjs\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`${testCommand}\` |
| fileScopeMustChange | \`src/example.mjs\` |

## Steps
### Step 1: Testing & Verification
- [ ] t

## Completion Criteria
- [ ] done

## Do NOT
- n
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

test('spine tasks validate fails on npm test -- false scope for required Size S', async () => {
	const projectRoot = await initGitRepo('spine-validate-npm-test-dash-');
	try {
		writeTask(
			projectRoot,
			'SP-540-npm-test-dash',
			'SP-540',
			promptWithNpmTestDashDash('SP-540', 'npm test -- tests/foo.test.mjs'),
		);

		const result = await runSpineTasksValidate({
			projectRoot,
			scope: 'SP-540',
		});

		assert.equal(result.exitCode, 1);
		assert.match(result.output, /npm test -- <path>/);
		assert.match(result.output, /full suite/);
		assert.match(result.output, /node --test/);
		assert.ok(
			result.result.tasks[0].errors?.some((error) => /npm test -- <path>/.test(error)),
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('spine tasks validate CLI exits non-zero on npm test -- error for required Size S', async () => {
	const projectRoot = await initGitRepo('spine-validate-npm-test-dash-cli-');
	try {
		writeTask(
			projectRoot,
			'SP-540-cli',
			'SP-540',
			promptWithNpmTestDashDash('SP-540', 'npm test -- tests/foo.test.mjs'),
		);

		const result = spawnSync(
			process.execPath,
			[SPINE_BIN, 'tasks', 'validate', 'SP-540'],
			{ cwd: projectRoot, encoding: 'utf-8' },
		);

		assert.notEqual(result.status, 0, result.stderr);
		assert.match(result.stdout + result.stderr, /npm test -- <path>/);
		assert.match(result.stdout + result.stderr, /node --test/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('spine tasks validate --warnings-only surfaces npm test -- warning for Size L', async () => {
	const projectRoot = await initGitRepo('spine-validate-npm-test-dash-l-');
	try {
		writeTask(
			projectRoot,
			'SP-540-npm-test-dash-l',
			'SP-540',
			promptWithNpmTestDashDash('SP-540', 'npm test -- tests/foo.test.mjs', 'L'),
		);

		const result = await runSpineTasksValidate({
			projectRoot,
			scope: 'SP-540',
			warningsOnly: true,
		});

		assert.equal(result.exitCode, 0);
		assert.match(result.output, /warning:.*npm test -- <path>/);
		assert.match(result.output, /node --test/);
		assert.ok(
			result.result.tasks[0].warnings?.some((warning) => /npm test -- <path>/.test(warning)),
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
