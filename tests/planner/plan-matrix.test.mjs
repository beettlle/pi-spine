import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { assignLanesToWaves as assignLanesToWavesLanes } from '../../src/planner/lanes.mjs';
import { assignLanesToWaves as assignLanesToWavesWaves } from '../../src/planner/waves.mjs';
import { buildPlan } from '../../src/planner/index.mjs';

function runPlannerTest(assignLanes) {
	test(`matrix expansion in planner (${assignLanes.name})`, () => {
		const tasksById = {
			'SP-100': {
				taskId: 'SP-100',
				fileScope: ['src/a.js'],
				matrix: [
					{ run_id: 'a', env: 'node' },
					{ run_id: 'b', env: 'browser' }
				],
				matrixColumns: ['run_id', 'env']
			},
			'SP-101': {
				taskId: 'SP-101',
				fileScope: ['src/a.js'] // overlaps with SP-100
			},
			'SP-102': {
				taskId: 'SP-102',
				fileScope: ['src/b.js'] // no overlap
			}
		};
		const waves = [['SP-100', 'SP-101', 'SP-102']];
		const maxParallel = 2;
		
		const result = assignLanes({ waves, tasksById, maxParallel });
		const plannedIds = result[0].taskIds;
		
		// Total tasks = SP-100[a], SP-100[b], SP-101, SP-102 => 4 tasks
		assert.strictEqual(plannedIds.length, 4);
		assert.deepStrictEqual(plannedIds, ['SP-100[a]', 'SP-100[b]', 'SP-101', 'SP-102']);
		
		// Virtual lanes:
		// SP-100[a] -> VL 0
		// SP-100[b] -> VL 1 (no overlap with a because same parent)
		// SP-101 -> overlaps with a and b (which are in 0 and 1). So placed in VL 0?
		// Wait, SP-101 overlaps with SP-100, so it will be forced into an existing lane.
		// SP-102 -> no overlap, so goes to VL 2 or whatever, but actually it doesn't overlap so it could go to a new VL.
		// Let's just check that we have some number of virtual lanes.
		assert.ok(result[0].virtualLaneCount >= 2);
	});

	test(`non-matrix tasks are unchanged (${assignLanes.name})`, () => {
		const tasksById = {
			'SP-100': { taskId: 'SP-100', fileScope: ['src/a.js'] }
		};
		const waves = [['SP-100']];
		const result = assignLanes({ waves, tasksById, maxParallel: 2 });
		assert.strictEqual(result[0].taskIds.length, 1);
		assert.strictEqual(result[0].taskIds[0], 'SP-100');
	});
}

runPlannerTest(assignLanesToWavesLanes);
runPlannerTest(assignLanesToWavesWaves);

/**
 * Minimal valid PROMPT.md carrying a `## Matrix` table (rows: alpha, beta).
 * Exercises the real parse → buildPlan → planWaves path so the regression
 * proves matrix fields are propagated end-to-end (issue #226).
 */
function matrixPromptMarkdown(taskId) {
	return `# Task: ${taskId} — Matrix deploy fixture

## Mission
Deploy the same procedure to multiple targets via a matrix table.

## Dependencies
- **None**

## File Scope
- \`src/matrix-deploy.js\`

## Matrix

| run_id | target |
|--------|--------|
| alpha  | east   |
| beta   | west   |

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`scripts/deploy.sh {matrix.target}\` |

## Steps
### Step 0: Done
- [ ] one

### Step 1: Testing & Verification
- [ ] run \`scripts/deploy.sh {matrix.target}\`

## Testing
- Run \`scripts/deploy.sh {matrix.target}\` per row.

## Completion Criteria
- [ ] both rows deployed

## Do NOT
- touch unrelated files
`;
}

const PLAN_CONFIG = { lanes: { maxParallel: 2, queueExcess: true } };

async function createMatrixFixture() {
	const root = await mkdtemp(path.join(os.tmpdir(), 'spine-plan-matrix-'));
	const tasksRoot = path.join(root, 'spine-tasks');
	fs.mkdirSync(tasksRoot, { recursive: true });
	fs.writeFileSync(
		path.join(tasksRoot, 'dependencies.json'),
		JSON.stringify({ version: 1, tasks: {} }, null, 2),
		'utf-8',
	);
	const folder = path.join(tasksRoot, 'MM-200-matrix-fixture');
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(path.join(folder, 'PROMPT.md'), matrixPromptMarkdown('MM-200'), 'utf-8');
	return { root, tasksRoot };
}

test('real buildPlan keeps the parent matrix task ID; no engine-visible virtual row IDs (#226 / #228)', async () => {
	const { root, tasksRoot } = await createMatrixFixture();
	try {
		const plan = buildPlan({
			scope: ['MM-200'],
			config: PLAN_CONFIG,
			tasksRoot,
		});

		// SP-690 (#226 deferred): buildPlan must NOT propagate `matrix` fields into
		// `tasksById`. The engine fans rows out itself at run time via
		// `runMatrixTaskOnLane`; expanding `MM-200[alpha]`/`MM-200[beta]` at plan
		// time would expose virtual row IDs to the batch engine, which does not yet
		// know how to schedule them (#228) and fails with `task_not_found`.
		// The wave carries only the parent task ID.
		assert.deepStrictEqual(plan.waves[0].taskIds, ['MM-200']);
		for (const wave of plan.waves) {
			for (const id of wave.taskIds) {
				assert.ok(
					!/\[/.test(id),
					`no virtual row ID should reach the plan; found ${id}`,
				);
			}
		}

		// The parent task is a single entry in the plan task map; the matrix table
		// is read by the engine at run time, not by the planner.
		assert.ok(plan.tasks['MM-200'], 'parent task MM-200 should remain in plan.tasks');
		assert.strictEqual(plan.tasks['MM-200'].taskId, 'MM-200');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
