import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import test from 'node:test';

import { buildPlan } from '../../src/planner/index.mjs';
import { formatPlanHuman } from '../../src/planner/format-plan.mjs';
import {
	collectWaveSizeWarnings,
	WAVE_SIZE_WARN_THRESHOLD,
} from '../../src/planner/waves.mjs';
import { minimalValidPromptMarkdown } from '../helpers/smoke-task-prompt.mjs';

const PLAN_CONFIG = { lanes: { maxParallel: 4, queueExcess: true } };

test('collectWaveSizeWarnings is silent at threshold', () => {
	const waves = [Array.from({ length: WAVE_SIZE_WARN_THRESHOLD }, (_, i) => `T-${i}`)];
	assert.deepEqual(collectWaveSizeWarnings(waves), []);
});

test('collectWaveSizeWarnings warns above threshold (M-CTR-04)', () => {
	const waves = [Array.from({ length: WAVE_SIZE_WARN_THRESHOLD + 1 }, (_, i) => `T-${i}`)];
	const lines = collectWaveSizeWarnings(waves);

	assert.ok(lines.length > 0);
	const text = lines.join('\n');
	assert.match(text, /Wave size warning/);
	assert.match(text, /9 tasks/);
	assert.match(text, /create-spine-tasks/);
	assert.match(text, /split waves/i);
});

/**
 * @param {number} taskCount
 */
async function createWaveSizeFixture(taskCount) {
	const root = await mkdtemp(path.join(os.tmpdir(), 'spine-wave-size-'));
	const tasksRoot = path.join(root, 'spine-tasks');
	fs.mkdirSync(tasksRoot, { recursive: true });
	fs.writeFileSync(
		path.join(tasksRoot, 'dependencies.json'),
		JSON.stringify({ version: 1, tasks: {} }, null, 2),
		'utf-8',
	);

	for (let i = 0; i < taskCount; i++) {
		const taskId = `WS-${String(i + 1).padStart(3, '0')}`;
		const folder = path.join(tasksRoot, `${taskId}-wave-size-fixture`);
		fs.mkdirSync(folder, { recursive: true });
		const body = minimalValidPromptMarkdown(taskId, {
			title: `${taskId} wave size fixture`,
			fileScope: `src/wave-size/${taskId}.mjs`,
		});
		fs.writeFileSync(path.join(folder, 'PROMPT.md'), body, 'utf-8');
	}

	return { root, tasksRoot };
}

test('buildPlan is silent when wave has 8 tasks', async () => {
	const { root, tasksRoot } = await createWaveSizeFixture(8);
	try {
		const taskIds = Array.from({ length: 8 }, (_, i) => `WS-${String(i + 1).padStart(3, '0')}`);
		const plan = buildPlan({
			scope: taskIds,
			config: PLAN_CONFIG,
			tasksRoot,
		});

		assert.equal(plan.waveSizeWarnings, undefined);
		assert.equal(plan.waves[0].taskIds.length, 8);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('buildPlan warns when wave has 9 tasks (M-CTR-04)', async () => {
	const { root, tasksRoot } = await createWaveSizeFixture(9);
	try {
		const taskIds = Array.from({ length: 9 }, (_, i) => `WS-${String(i + 1).padStart(3, '0')}`);
		const plan = buildPlan({
			scope: taskIds,
			config: PLAN_CONFIG,
			tasksRoot,
		});

		assert.ok(Array.isArray(plan.waveSizeWarnings));
		const warningText = plan.waveSizeWarnings.join('\n');
		assert.match(warningText, /Wave size warning/);
		assert.match(warningText, /9 tasks/);
		assert.match(warningText, /create-spine-tasks/);

		const human = formatPlanHuman(plan);
		assert.match(human, /Wave size warning/);
		assert.match(human, /9 tasks/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
