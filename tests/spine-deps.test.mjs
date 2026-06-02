import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
	buildDepsReport,
	cycleNodesFromPath,
	depsToEdges,
	formatDepsHuman,
} from '../src/cli/deps.mjs';
import { buildGraph } from '../src/planner/graph.mjs';
import { findCyclePath } from '../src/planner/cycles.mjs';
import { destroyGitRepo, initGitRepo } from './helpers/git-fixture.mjs';

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'spine.mjs');
const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function writeTask(projectRoot, taskId, deps = []) {
	const folder = path.join(projectRoot, 'taskplane-tasks', `${taskId}-test`);
	fs.mkdirSync(folder, { recursive: true });

	const depLines =
		deps.length === 0
			? '- **None**'
			: deps.map((dep) => `- **${dep}**`).join('\n');

	fs.writeFileSync(
		path.join(folder, 'PROMPT.md'),
		`# Task: ${taskId} — Deps test

## Mission
Test deps.

## Dependencies
${depLines}

## File Scope
- \`README.md\`

## Steps
### Step 0: Work
- [ ] a

## Completion Criteria
- [ ] done

## Do NOT
- scope creep
`,
		'utf-8',
	);
}

function writeDependencies(projectRoot, tasks) {
	fs.writeFileSync(
		path.join(projectRoot, 'taskplane-tasks', 'dependencies.json'),
		JSON.stringify({ version: 1, tasks }, null, 2),
		'utf-8',
	);
}

test('buildDepsReport returns empty graph for isolated task with no deps', async () => {
	const projectRoot = await initGitRepo('spine-deps-empty-');
	try {
		writeTask(projectRoot, 'TP-801');
		writeDependencies(projectRoot, { 'TP-801': [] });

		const config = JSON.parse(
			fs.readFileSync(path.join(projectRoot, '.spine', 'spine-config.json'), 'utf-8'),
		);
		const report = buildDepsReport({ projectRoot, scope: 'TP-801', config });

		assert.deepEqual(report.nodes, ['TP-801']);
		assert.deepEqual(report.edges, []);
		assert.deepEqual(report.cycles, []);
		assert.equal(report.error, undefined);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('buildDepsReport detects synthetic dependency cycle', async () => {
	const projectRoot = await initGitRepo('spine-deps-cycle-');
	try {
		writeTask(projectRoot, 'TP-811', ['TP-812']);
		writeTask(projectRoot, 'TP-812', ['TP-811']);
		writeDependencies(projectRoot, {
			'TP-811': ['TP-812'],
			'TP-812': ['TP-811'],
		});

		const config = JSON.parse(
			fs.readFileSync(path.join(projectRoot, '.spine', 'spine-config.json'), 'utf-8'),
		);
		const report = buildDepsReport({
			projectRoot,
			scope: 'TP-811 TP-812',
			config,
		});

		assert.ok(report.cycles.length > 0);
		assert.match(report.error ?? '', /cycle/i);
		assert.deepEqual(report.edges, [
			{ from: 'TP-811', to: 'TP-812' },
			{ from: 'TP-812', to: 'TP-811' },
		]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('cycleNodesFromPath deduplicates closing node', () => {
	assert.deepEqual(cycleNodesFromPath(['A', 'B', 'C', 'A']), ['A', 'B', 'C']);
});

test('depsToEdges and formatDepsHuman render dependency flow', () => {
	const graph = buildGraph({ 'TP-002': ['TP-001'] });
	const edges = depsToEdges(graph.depsByTask);
	const text = formatDepsHuman({
		scope: { mode: 'ids', taskIds: ['TP-001', 'TP-002'] },
		nodes: graph.nodes,
		edges,
		cycles: [],
	});

	assert.deepEqual(edges, [{ from: 'TP-001', to: 'TP-002' }]);
	assert.match(text, /TP-001 → TP-002/);
	assert.match(text, /Nodes: 2/);
});

test('repo fixture TP-031 scope shows TP-030 dependency edge', () => {
	const config = JSON.parse(
		fs.readFileSync(path.join(REPO_ROOT, '.spine', 'spine-config.json'), 'utf-8'),
	);
	const report = buildDepsReport({ projectRoot: REPO_ROOT, scope: 'TP-031', config });

	assert.deepEqual(report.nodes, ['TP-030', 'TP-031']);
	assert.deepEqual(report.edges, [{ from: 'TP-030', to: 'TP-031' }]);
	assert.deepEqual(report.cycles, []);
	assert.ok(Array.isArray(report.waves));
});

test('spine deps CLI emits JSON shape with nodes, edges, cycles, waves', async () => {
	const projectRoot = await initGitRepo('spine-deps-json-');
	try {
		writeTask(projectRoot, 'TP-821', ['TP-820']);
		writeTask(projectRoot, 'TP-820');
		writeDependencies(projectRoot, {
			'TP-820': [],
			'TP-821': ['TP-820'],
		});

		const result = spawnSync(
			process.execPath,
			[SPINE_BIN, 'deps', 'TP-820 TP-821', '--json'],
			{ cwd: projectRoot, encoding: 'utf-8' },
		);

		assert.equal(result.status, 0, result.stderr);
		const parsed = JSON.parse(result.stdout);
		assert.ok(Array.isArray(parsed.nodes));
		assert.ok(Array.isArray(parsed.edges));
		assert.ok(Array.isArray(parsed.cycles));
		assert.ok(Array.isArray(parsed.waves));
		assert.deepEqual(parsed.edges, [{ from: 'TP-820', to: 'TP-821' }]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('spine deps CLI exits 1 when cycle detected', async () => {
	const projectRoot = await initGitRepo('spine-deps-exit-');
	try {
		writeTask(projectRoot, 'TP-831', ['TP-832']);
		writeTask(projectRoot, 'TP-832', ['TP-831']);
		writeDependencies(projectRoot, {
			'TP-831': ['TP-832'],
			'TP-832': ['TP-831'],
		});

		const result = spawnSync(process.execPath, [SPINE_BIN, 'deps', 'TP-831 TP-832'], {
			cwd: projectRoot,
			encoding: 'utf-8',
		});

		assert.equal(result.status, 1);
		assert.match(result.stdout, /Cycle:/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('findCyclePath returns path for cyclic graph', () => {
	const graph = buildGraph({
		A: ['B'],
		B: ['C'],
		C: ['A'],
	});
	const cycle = findCyclePath(graph);
	assert.ok(cycle);
	assert.deepEqual(cycleNodesFromPath(cycle), ['A', 'B', 'C']);
});
