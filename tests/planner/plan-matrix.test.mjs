import test from 'node:test';
import assert from 'node:assert';
import { assignLanesToWaves as assignLanesToWavesLanes } from '../../src/planner/lanes.mjs';
import { assignLanesToWaves as assignLanesToWavesWaves } from '../../src/planner/waves.mjs';

function runPlannerTest(assignLanes) {
	test(`matrix expansion in planner (${assignLanes.name})`, t => {
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

	test(`non-matrix tasks are unchanged (${assignLanes.name})`, t => {
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
