import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { validatePrompt } from '../../src/tasks/packet/validate-prompt.mjs';

const FIXTURE_ROOT = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'test',
	'fixtures',
	'taskplane',
);

/**
 * @param {string} folderName
 */
function readFixturePrompt(folderName) {
	return fs.readFileSync(path.join(FIXTURE_ROOT, folderName, 'PROMPT.md'), 'utf-8');
}

test('FX-invalid-no-testing fails validatePrompt for missing Testing step', () => {
	const markdown = readFixturePrompt('FX-invalid-no-testing');
	const result = validatePrompt(markdown);

	assert.equal(result.ok, false);
	assert.ok(result.errors.some((error) => /testing/i.test(error)));
});

test('FX-missing-contract fails validatePrompt in required contract mode', () => {
	const markdown = readFixturePrompt('FX-missing-contract');
	const result = validatePrompt(markdown, {
		contract: { mode: 'required', legacyTaskIdPrefixes: ['TP-'] },
	});

	assert.equal(result.ok, false);
	assert.ok(result.errors.some((error) => /contract/i.test(error)));
});

test('FX-valid-contract passes validatePrompt in required contract mode', () => {
	const markdown = readFixturePrompt('FX-valid-contract');
	const result = validatePrompt(markdown, {
		contract: { mode: 'required', legacyTaskIdPrefixes: ['TP-'] },
	});

	assert.equal(result.ok, true);
	assert.deepEqual(result.errors, []);
});

test('FX-final-replan has Review Level >= 1 for REPLAN integration path', () => {
	const markdown = readFixturePrompt('FX-final-replan');

	assert.match(markdown, /## Review Level:\s*1/);
	assert.match(markdown, /### Step \d+:/);
});
