import assert from 'node:assert/strict';
import test from 'node:test';

import {
	expandFileScopeProbes,
	fileScopePatternsOverlap,
	fileScopesOverlap,
	findWaveFileScopeOverlaps,
	normalizeFileScopePath,
	pathsOverlap,
} from '../../src/planner/file-scope.mjs';

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
