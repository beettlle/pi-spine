import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import test from 'node:test';

import { buildPlan } from '../../src/planner/index.mjs';
import { formatPlanHuman } from '../../src/planner/format-plan.mjs';
import {
	expandFileScopeProbes,
	fileScopePatternsOverlap,
	fileScopesOverlap,
	findWaveFileScopeOverlaps,
	normalizeFileScopePath,
	pathsOverlap,
} from '../../src/planner/file-scope.mjs';
import {
	assignLanesToWaves,
	formatFileScopeOverlapWarnings,
	planWaves,
} from '../../src/planner/waves.mjs';
import { minimalValidPromptMarkdown } from '../helpers/smoke-task-prompt.mjs';

test('normalizeFileScopePath strips trailing globs and normalizes separators', () => {
	assert.equal(normalizeFileScopePath('src/a/**'), 'src/a');
	assert.equal(normalizeFileScopePath('src/a/*'), 'src/a');
	assert.equal(normalizeFileScopePath('.\\src\\a\\'), 'src/a');
	assert.equal(normalizeFileScopePath(''), null);
});

test('pathsOverlap detects parent/child and rejects unrelated prefixes', () => {
	assert.equal(pathsOverlap('src/a', 'src/a'), true);
	assert.equal(pathsOverlap('src/a', 'src/a/b'), true);
	assert.equal(pathsOverlap('src/a/b', 'src/a'), true);
	assert.equal(pathsOverlap('src/a', 'src/ab'), false);
	assert.equal(pathsOverlap('src/a', 'src/b'), false);
});

test('fileScopesOverlap detects parent/child directory overlap', () => {
	assert.equal(fileScopesOverlap(['src/shared/**'], ['src/shared/utils/**']), true);
	assert.equal(fileScopesOverlap(['internal/safety/revert.go'], ['internal/safety/**']), true);
	assert.equal(fileScopesOverlap(['src/a/**'], ['src/b/**']), false);
});

test('fileScopesOverlap detects exact file overlap in same wave scenario', () => {
	assert.equal(fileScopesOverlap(['bin/spine.mjs'], ['bin/spine.mjs']), true);
	assert.equal(
		fileScopesOverlap(['src/cli/settings-set.mjs'], ['src/cli/settings-set.mjs', 'bin/spine-settings.mjs']),
		true,
	);
});

test('fileScopePatternsOverlap handles wildcard file globs', () => {
	assert.equal(fileScopePatternsOverlap('bin/*.mjs', 'bin/spine.mjs'), true);
	assert.equal(fileScopePatternsOverlap('bin/spine.mjs', 'bin/*.mjs'), true);
	assert.equal(fileScopePatternsOverlap('bin/*.mjs', 'src/*.mjs'), false);
});

test('fileScopePatternsOverlap does not treat dotted sibling paths as overlapping', () => {
	assert.equal(fileScopePatternsOverlap('src/foo/**', 'src/foo.bar/**'), false);
	assert.equal(fileScopePatternsOverlap('src/foo', 'src/foo.bar'), false);
});

test('fileScopePatternsOverlap handles literal paths with regex metacharacters', () => {
	assert.equal(fileScopePatternsOverlap('docs/(api)/x.mjs', 'docs/(api)/x.mjs'), true);
	assert.equal(fileScopePatternsOverlap('pkg/v1+2/a.mjs', 'pkg/v1+2/**'), true);
	assert.equal(fileScopePatternsOverlap('docs/(api)/**', 'docs/other/**'), false);
});

test('expandFileScopeProbes produces nested paths for directory globs', () => {
	const probes = expandFileScopeProbes(['src/a/**']);
	assert.ok(probes.some((probe) => probe.startsWith('src/a/')));
	assert.ok(probes.includes('src/a/**'));
});

test('expandFileScopeProbes expands brace globs into concrete probe paths', () => {
	const probes = expandFileScopeProbes(['src/{a,b}/**']);
	assert.ok(probes.includes('src/a/**'));
	assert.ok(probes.includes('src/b/**'));
	assert.ok(probes.some((probe) => probe.startsWith('src/a/') && probe.endsWith('.mjs')));
	assert.ok(probes.some((probe) => probe.startsWith('src/b/') && probe.endsWith('.json')));
	assert.ok(probes.every((probe) => !probe.includes('{')));
});

test('expandFileScopeProbes probes json/cjs/yaml extensions for directory entries', () => {
	const probes = expandFileScopeProbes(['config']);
	assert.ok(probes.includes('config/__probe__.json'));
	assert.ok(probes.includes('config/__probe__.cjs'));
	assert.ok(probes.includes('config/__probe__.yaml'));
	assert.ok(probes.includes('config/__probe__.yml'));
});

test('expandFileScopeProbes bounds probe count for wide brace globs', () => {
	const probes = expandFileScopeProbes(['s/{a,b,c,d,e,f,g,h}/{i,j,k,l,m,n,o,p}/**']);
	// 32-variant brace cap × (1 entry + 2 probe shapes × 14 extensions) probes.
	assert.ok(probes.length <= 32 * 29);
});

test('fileScopePatternsOverlap detects overlapping brace scopes', () => {
	assert.equal(fileScopePatternsOverlap('src/{a,b}/**', 'src/a/x.mjs'), true);
	assert.equal(fileScopePatternsOverlap('src/a/x.mjs', 'src/{a,b}/**'), true);
	assert.equal(fileScopePatternsOverlap('src/{a,b}/**', 'src/{b,c}/**'), true);
	assert.equal(fileScopePatternsOverlap('src/{a,b}/**', 'src/{c,d}/**'), false);
	assert.equal(fileScopePatternsOverlap('src/{a,b}.mjs', 'src/b.mjs'), true);
	assert.equal(fileScopePatternsOverlap('src/{a,b}.mjs', 'src/c.mjs'), false);
});

test('fileScopePatternsOverlap detects .json/.cjs/.yaml extension collisions', () => {
	assert.equal(fileScopePatternsOverlap('config/**', 'config/app.json'), true);
	assert.equal(fileScopePatternsOverlap('lib/**', 'lib/util.cjs'), true);
	assert.equal(fileScopePatternsOverlap('ci/**', 'ci/workflow.yaml'), true);
	assert.equal(fileScopePatternsOverlap('ci/**', 'ci/workflow.yml'), true);
	assert.equal(fileScopePatternsOverlap('config/*', 'config/app.json'), true);
	assert.equal(fileScopePatternsOverlap('config/**', 'other/app.json'), false);
});

test('findWaveFileScopeOverlaps returns pairs within the same wave only', () => {
	const waves = [['A', 'B'], ['C', 'D']];
	const tasksById = {
		A: { fileScope: ['src/shared/**'] },
		B: { fileScope: ['src/shared/utils/**'] },
		C: { fileScope: ['src/c/**'] },
		D: { fileScope: ['src/d/**'] },
	};

	const overlaps = findWaveFileScopeOverlaps(waves, tasksById);
	assert.equal(overlaps.length, 1);
	assert.equal(overlaps[0].waveIndex, 0);
	assert.deepEqual(overlaps[0].taskA, 'A');
	assert.deepEqual(overlaps[0].taskB, 'B');
});

test('findWaveFileScopeOverlaps matches issue #31 parent/child safety paths', () => {
	const waves = [['SP-072', 'SP-074']];
	const tasksById = {
		'SP-072': { fileScope: ['internal/safety/revert.go'] },
		'SP-074': { fileScope: ['internal/safety/**'] },
	};

	const overlaps = findWaveFileScopeOverlaps(waves, tasksById);
	assert.equal(overlaps.length, 1);
	assert.equal(overlaps[0].taskA, 'SP-072');
	assert.equal(overlaps[0].taskB, 'SP-074');
});

test('findWaveFileScopeOverlaps ignores single-task waves', () => {
	const overlaps = findWaveFileScopeOverlaps([['ONLY']], {
		ONLY: { fileScope: ['src/a/**', 'src/b/**'] },
	});
	assert.deepEqual(overlaps, []);
});

test('planWaves serializes two tasks with the same file to one virtual lane', () => {
	const waves = [['A', 'B']];
	const tasksById = {
		A: { fileScope: ['bin/spine.mjs'] },
		B: { fileScope: ['bin/spine.mjs'] },
	};

	const { waves: planned, fileScopeOverlaps } = planWaves({
		waves,
		tasksById,
		maxParallel: 4,
		queueExcess: true,
	});

	assert.equal(fileScopeOverlaps.length, 1);
	assert.equal(planned[0].virtualLaneCount, 1);
	assert.deepEqual(planned[0].ticks[0].lanes[0], ['A', 'B']);
});

test('assignLanesToWaves uses glob-aware overlap for wildcard scopes', () => {
	const waves = [['A', 'B']];
	const tasksById = {
		A: { fileScope: ['bin/*.mjs'] },
		B: { fileScope: ['bin/spine.mjs'] },
	};

	const planned = assignLanesToWaves({ waves, tasksById, maxParallel: 4, queueExcess: true });
	assert.equal(planned[0].virtualLaneCount, 1);
	assert.deepEqual(planned[0].ticks[0].lanes[0], ['A', 'B']);
});

test('formatFileScopeOverlapWarnings lists wave and task pairs', () => {
	const lines = formatFileScopeOverlapWarnings([
		{
			waveIndex: 0,
			taskA: 'A',
			taskB: 'B',
			scopesA: ['src/a/**'],
			scopesB: ['src/a/b/**'],
		},
	]);

	assert.match(lines.join('\n'), /Wave 0: A ↔ B/);
	assert.match(lines.join('\n'), /serialized to the same lane/);
});

const PLAN_CONFIG = { lanes: { maxParallel: 4, queueExcess: true } };

async function createOverlapPlanFixture() {
	const root = await mkdtemp(path.join(os.tmpdir(), 'spine-overlap-plan-'));
	const tasksRoot = path.join(root, 'spine-tasks');
	fs.mkdirSync(tasksRoot, { recursive: true });
	fs.writeFileSync(
		path.join(tasksRoot, 'dependencies.json'),
		JSON.stringify({ version: 1, tasks: {} }, null, 2),
		'utf-8',
	);

	for (const [taskId, fileScope] of [
		['OL-001', 'bin/spine.mjs'],
		['OL-002', 'bin/spine.mjs'],
	]) {
		const folder = path.join(tasksRoot, `${taskId}-overlap-fixture`);
		fs.mkdirSync(folder, { recursive: true });
		const body = minimalValidPromptMarkdown(taskId, {
			title: `${taskId} overlap fixture`,
			fileScope,
		});
		fs.writeFileSync(path.join(folder, 'PROMPT.md'), body, 'utf-8');
	}

	return { root, tasksRoot };
}

test('buildPlan reports file-scope overlaps and serializes conflicting tasks', async () => {
	const { root, tasksRoot } = await createOverlapPlanFixture();
	try {
		const plan = buildPlan({
			scope: ['OL-001', 'OL-002'],
			config: PLAN_CONFIG,
			tasksRoot,
		});

		assert.equal(plan.metadata.fileScopeOverlaps?.length, 1);
		assert.ok(Array.isArray(plan.overlapWarnings));
		assert.match(plan.overlapWarnings.join('\n'), /OL-001/);
		assert.match(plan.overlapWarnings.join('\n'), /OL-002/);
		assert.equal(plan.waves[0].virtualLaneCount, 1);

		const human = formatPlanHuman(plan);
		assert.match(human, /serial · 2 tasks \(overlapping file scope\)/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
