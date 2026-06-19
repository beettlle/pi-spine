import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { runSpineTasksAnalyze } from '../../bin/spine-tasks.mjs';
import {
	collectPromptJsonDepsDriftFindings,
	collectWaveMCountFindings,
	extractExploreSlugsFromContext,
	fileScopesOverlap,
} from '../../src/tasks/analyze/index.mjs';
import { destroyGitRepo, initGitRepo } from '../helpers/git-fixture.mjs';

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'spine.mjs');

const VALID_CONTRACT_SECTION = `## Contract

| Field | Value |
|-------|-------|
| testCommand | \`npm test\` |
| fileScopeMustChange | \`src/example.mjs\` |
`;

/**
 * @param {string} taskId
 * @param {{ title?: string, size?: string, fileScope?: string, dependencies?: string, extraBody?: string }} [options]
 */
function validPromptMarkdown(
	taskId,
	{
		title = 'Analyze fixture',
		size = 'S',
		fileScope = 'src/example.mjs',
		dependencies = '- **None**',
		extraBody = '',
	} = {},
) {
	return `# Task: ${taskId} — ${title}

**Created:** 2026-06-18
**Size:** ${size}

## Mission
Smoke analyze task.

## Dependencies
${dependencies}

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

/**
 * @param {string} projectRoot
 * @param {Record<string, string[]>} tasks
 */
function writeDependenciesJson(projectRoot, tasks) {
	fs.writeFileSync(
		path.join(projectRoot, 'spine-tasks', 'dependencies.json'),
		JSON.stringify({ version: 1, tasks }, null, 2),
		'utf-8',
	);
}

test('fileScopesOverlap detects parent/child path overlap', () => {
	assert.equal(fileScopesOverlap(['src/a'], ['src/a/b']), true);
	assert.equal(fileScopesOverlap(['src/a'], ['src/b']), false);
});

test('extractExploreSlugsFromContext finds explore findings paths', () => {
	const slugs = extractExploreSlugsFromContext(
		'Explore: [`spine-tasks/_explore/reliability-epic/findings.md`](_explore/reliability-epic/findings.md)',
	);
	assert.deepEqual(slugs, ['reliability-epic']);
});

test('collectWaveMCountFindings warns when a wave has more than four M tasks', () => {
	const findings = collectWaveMCountFindings(
		[['AN-001', 'AN-002', 'AN-003', 'AN-004', 'AN-005']],
		{
			'AN-001': { size: 'M' },
			'AN-002': { size: 'M' },
			'AN-003': { size: 'M' },
			'AN-004': { size: 'M' },
			'AN-005': { size: 'M' },
		},
	);
	assert.equal(findings.length, 1);
	assert.equal(findings[0].code, 'wave_m_count');
	assert.equal(findings[0].severity, 'warning');
});

test('collectPromptJsonDepsDriftFindings reports missing JSON entry', () => {
	const findings = collectPromptJsonDepsDriftFindings(
		{ 'AN-010': { promptDependencies: ['AN-009'] } },
		{ tasks: {} },
	);
	assert.equal(findings[0].code, 'prompt_deps_json_missing');
	assert.equal(findings[0].severity, 'warning');
});

test('runSpineTasksAnalyze exits 0 for clean scope', async () => {
	const projectRoot = await initGitRepo('spine-analyze-pass-');
	try {
		writeTask(projectRoot, 'AN-101-clean', 'AN-101', validPromptMarkdown('AN-101'));

		const result = await runSpineTasksAnalyze({ projectRoot, scope: 'AN-101' });
		assert.equal(result.exitCode, 0);
		assert.equal(result.result.ok, true);
		assert.match(result.output, /No structural issues found/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('runSpineTasksAnalyze reports parallel file-scope overlap as blocking', async () => {
	const projectRoot = await initGitRepo('spine-analyze-overlap-');
	try {
		writeTask(
			projectRoot,
			'AN-201-a',
			'AN-201',
			validPromptMarkdown('AN-201', { fileScope: 'src/shared.mjs' }),
		);
		writeTask(
			projectRoot,
			'AN-202-b',
			'AN-202',
			validPromptMarkdown('AN-202', { fileScope: 'src/shared.mjs' }),
		);
		writeDependenciesJson(projectRoot, { 'AN-201': [], 'AN-202': [] });

		const result = await runSpineTasksAnalyze({ projectRoot, scope: 'AN-201 AN-202' });
		assert.equal(result.exitCode, 1);
		assert.equal(result.result.ok, false);
		assert.ok(
			result.result.findings.some((finding) => finding.code === 'parallel_file_scope_overlap'),
		);
		assert.match(result.output, /blocking:/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('runSpineTasksAnalyze reports dependency cycle as blocking', async () => {
	const projectRoot = await initGitRepo('spine-analyze-cycle-');
	try {
		writeTask(projectRoot, 'AN-301-a', 'AN-301', validPromptMarkdown('AN-301', { fileScope: 'src/a.mjs' }));
		writeTask(projectRoot, 'AN-302-b', 'AN-302', validPromptMarkdown('AN-302', { fileScope: 'src/b.mjs' }));
		writeDependenciesJson(projectRoot, {
			'AN-301': ['AN-302'],
			'AN-302': ['AN-301'],
		});

		const result = await runSpineTasksAnalyze({ projectRoot, scope: 'AN-301 AN-302' });
		assert.equal(result.exitCode, 1);
		assert.ok(result.result.findings.some((finding) => finding.code === 'dependency_cycle'));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('runSpineTasksAnalyze exits 0 when only warnings are present', async () => {
	const projectRoot = await initGitRepo('spine-analyze-warn-');
	try {
		writeTask(
			projectRoot,
			'AN-401-deps',
			'AN-401',
			validPromptMarkdown('AN-401', {
				dependencies: '- AN-400',
			}),
		);
		writeDependenciesJson(projectRoot, { 'AN-401': [] });

		const result = await runSpineTasksAnalyze({ projectRoot, scope: 'AN-401' });
		assert.equal(result.exitCode, 0);
		assert.equal(result.result.ok, true);
		assert.ok(result.result.warningCount > 0);
		assert.ok(
			result.result.findings.some((finding) => finding.code === 'prompt_deps_json_drift'),
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('runSpineTasksAnalyze warns for missing explore findings referenced in CONTEXT', async () => {
	const projectRoot = await initGitRepo('spine-analyze-explore-');
	try {
		writeTask(projectRoot, 'AN-501-explore', 'AN-501', validPromptMarkdown('AN-501'));
		fs.writeFileSync(
			path.join(projectRoot, 'spine-tasks', 'CONTEXT.md'),
			'Explore: spine-tasks/_explore/feature-x/findings.md\n',
			'utf-8',
		);

		const result = await runSpineTasksAnalyze({ projectRoot, scope: 'AN-501' });
		assert.equal(result.exitCode, 0);
		assert.ok(
			result.result.findings.some((finding) => finding.code === 'explore_findings_missing'),
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('runSpineTasksAnalyze --json emits AnalyzeTasksResult', async () => {
	const projectRoot = await initGitRepo('spine-analyze-json-');
	try {
		writeTask(projectRoot, 'AN-601-json', 'AN-601', validPromptMarkdown('AN-601'));

		const result = await runSpineTasksAnalyze({
			projectRoot,
			scope: 'AN-601',
			json: true,
		});
		assert.equal(result.exitCode, 0);

		const parsed = JSON.parse(result.output.trim());
		assert.equal(parsed.ok, true);
		assert.equal(parsed.scope.taskCount, 1);
		assert.equal(parsed.blockingCount, 0);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('spine tasks analyze CLI exits 1 for blocking overlap', async () => {
	const projectRoot = await initGitRepo('spine-analyze-cli-block-');
	try {
		writeTask(
			projectRoot,
			'AN-701-a',
			'AN-701',
			validPromptMarkdown('AN-701', { fileScope: 'src/cli.mjs' }),
		);
		writeTask(
			projectRoot,
			'AN-702-b',
			'AN-702',
			validPromptMarkdown('AN-702', { fileScope: 'src/cli.mjs' }),
		);
		writeDependenciesJson(projectRoot, { 'AN-701': [], 'AN-702': [] });

		const result = spawnSync(process.execPath, [SPINE_BIN, 'tasks', 'analyze', 'AN-701 AN-702'], {
			cwd: projectRoot,
			encoding: 'utf-8',
		});

		assert.equal(result.status, 1, result.stderr);
		assert.match(result.stdout, /blocking:/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('spine tasks analyze CLI exits 0 for warnings-only scope', async () => {
	const projectRoot = await initGitRepo('spine-analyze-cli-warn-');
	try {
		writeTask(
			projectRoot,
			'AN-801-deps',
			'AN-801',
			validPromptMarkdown('AN-801', {
				dependencies: '- AN-800',
			}),
		);
		writeDependenciesJson(projectRoot, { 'AN-801': [] });

		const result = spawnSync(process.execPath, [SPINE_BIN, 'tasks', 'analyze', 'AN-801'], {
			cwd: projectRoot,
			encoding: 'utf-8',
		});

		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /warning:/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('spine help tasks documents analyze subcommand', () => {
	const result = spawnSync(process.execPath, [SPINE_BIN, 'help', 'tasks'], {
		encoding: 'utf-8',
	});
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /spine tasks analyze/i);
	assert.match(result.stdout, /--json/);
});
