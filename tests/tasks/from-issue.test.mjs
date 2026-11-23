import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
	buildPromptScaffold,
	buildStatusScaffold,
	fetchIssueViaGh,
	parseIssueJson,
	readNextTaskId,
	scaffoldTaskFolder,
	slugifyTitle,
	updateNextTaskId,
	FromIssueError,
} from '../../src/tasks/from-issue.mjs';
import { runSpineTasksFromIssue, runSpineTasksValidate } from '../../bin/spine-tasks.mjs';
import { destroyGitRepo, initGitRepo } from '../helpers/git-fixture.mjs';

const ISSUE_384 = {
	number: 384,
	title: 'Enhancement: hydrate SP-* packets from a GitHub issue',
	body: 'Scaffold spine task packets from a GitHub issue.',
};

/**
 * Write a fake `gh` executable that echoes canned issue JSON for `gh issue view <n>`.
 *
 * @param {string} dir Directory for the shim
 * @param {{ exitCode?: number, stderr?: string }} [options]
 * @returns {string} Path to the shim (pass as ghCommand)
 */
function writeGhShim(dir, { exitCode = 0, stderr = 'issue not found' } = {}) {
	fs.mkdirSync(dir, { recursive: true });
	const shimPath = path.join(dir, `gh-${Math.random().toString(36).slice(2, 8)}`);
	const body = [
		'#!/usr/bin/env node',
		'const n = Number(process.argv[4]);',
		...(exitCode !== 0
			? [`console.error(${JSON.stringify(stderr)});`, `process.exit(${exitCode});`]
			: ['console.log(JSON.stringify({ number: n, title: "Issue " + n + ": hydrate packets", body: "stub body" }));']),
		'',
	].join('\n');
	fs.writeFileSync(shimPath, body, { mode: 0o755 });
	return shimPath;
}

test('slugifyTitle lowercases, collapses punctuation, trims, and caps length', () => {
	assert.equal(slugifyTitle('Enhancement: hydrate SP-* packets from a GitHub issue'), 'enhancement-hydrate-sp-packets-from-a-github-iss');
	assert.equal(slugifyTitle('  Trim -- me  '), 'trim-me');
	assert.equal(slugifyTitle(''), 'issue');
	assert.equal(slugifyTitle('!!!'), 'issue');
	assert.ok(slugifyTitle('a'.repeat(200)).length <= 48);
	assert.doesNotMatch(slugifyTitle('weird /\\: title'), /[^a-z0-9-]/);
});

test('buildPromptScaffold golden shape: thin Mission link, empty contract, testing step', () => {
	const md = buildPromptScaffold({ taskId: 'SP-890', issue: ISSUE_384, linkType: 'closes', created: '2026-11-22' });

	// Heading and metadata
	assert.match(md, /^# Task: SP-890 — Enhancement: hydrate SP-\* packets from a GitHub issue\n/);
	assert.match(md, /\*\*Created:\*\* 2026-11-22/);

	// #147 standard link format on the first Mission line
	assert.match(md, /## Mission\n\nCloses #384 — Enhancement: hydrate SP-\* packets from a GitHub issue\./);

	// Thin packet: pointer to the issue, no pasted body
	assert.match(md, /`gh issue view 384`/);
	assert.ok(!md.includes('Scaffold spine task packets from a GitHub issue.'), 'issue body must not be pasted into the packet');

	// Contract stub is empty (validate must fail until operator fills)
	assert.match(md, /\| testCommand \| {2}\|/);
	assert.match(md, /TODO\(operator\): fill every field/);
	assert.ok(!/\| testCommand \| `[^`]+` \|/.test(md), 'scaffold must not claim a testCommand');

	// Required sections for later validation
	for (const section of ['## Mission', '## Dependencies', '## File Scope', '## Contract', '## Steps', '## Completion Criteria', '## Do NOT']) {
		assert.ok(md.includes(section), `missing section ${section}`);
	}
	assert.match(md, /### Step 1: Testing & Verification/);

	// Worker-scope bans (#149)
	assert.match(md, /`\.spine\/`/);
	assert.match(md, /`AGENTS\.md`/);

	// No dependencies.json edges promised
	assert.match(md, /this scaffold never writes dependencies\.json edges/);
});

test('buildPromptScaffold supports --partial Mission link', () => {
	const md = buildPromptScaffold({ taskId: 'SP-891', issue: ISSUE_384, linkType: 'partial', created: '2026-11-22' });
	assert.match(md, /## Mission\n\nPartial #384 — /);
});

test('buildStatusScaffold mirrors scaffold steps', () => {
	const status = buildStatusScaffold({ taskId: 'SP-890', created: '2026-11-22' });
	assert.match(status, /^# STATUS — SP-890\n/);
	assert.match(status, /### Step 0: TODO\(operator\) — Implementation/);
	assert.match(status, /### Step 1: Testing & Verification/);
	assert.match(status, /spine tasks validate SP-890/);
});

test('parseIssueJson fails loud on malformed or mismatched payloads', () => {
	assert.throws(() => parseIssueJson('not json', 384), FromIssueError);
	assert.throws(() => parseIssueJson('[]', 384), FromIssueError);
	assert.throws(() => parseIssueJson('{"number": 999, "title": "x"}', 384), /returned issue #999 but #384/);
	assert.throws(() => parseIssueJson('{"number": 384}', 384), /returned no title/);
	const issue = parseIssueJson('{"number": 384, "title": "  T  ", "body": null}', 384);
	assert.deepEqual(issue, { number: 384, title: 'T', body: '' });
});

test('fetchIssueViaGh parses shim output and fails loud on gh errors', async () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sp888-gh-'));
	try {
		const shim = writeGhShim(tmp);
		const issue = fetchIssueViaGh({ issueNumber: 384, projectRoot: tmp, ghCommand: shim });
		assert.equal(issue.number, 384);
		assert.equal(issue.title, 'Issue 384: hydrate packets');

		assert.throws(
			() => fetchIssueViaGh({ issueNumber: 99, projectRoot: tmp, ghCommand: path.join(tmp, 'missing-gh') }),
			/gh CLI not found on PATH/,
		);

		const failShim = writeGhShim(path.join(tmp, 'fail'), { exitCode: 1, stderr: 'issue not found' });
		assert.throws(
			() => fetchIssueViaGh({ issueNumber: 99, projectRoot: tmp, ghCommand: failShim }),
			/issue not found/u,
		);

		assert.throws(
			() => fetchIssueViaGh({ issueNumber: 0, projectRoot: tmp, ghCommand: shim }),
			/Invalid issue number/,
		);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test('scaffoldTaskFolder writes stubs, derives ID from CONTEXT, never touches dependencies.json', () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sp888-scaffold-'));
	try {
		const tasksRoot = path.join(tmp, 'spine-tasks');
		fs.mkdirSync(tasksRoot, { recursive: true });
		fs.writeFileSync(path.join(tasksRoot, 'CONTEXT.md'), '**Next Task ID:** SP-890\n', 'utf-8');

		const result = scaffoldTaskFolder({
			tasksRoot,
			issue: ISSUE_384,
			linkType: 'closes',
			slug: 'hydrate-issue',
			created: '2026-11-22',
		});
		assert.equal(result.taskId, 'SP-890');
		assert.equal(result.contextNextIdUpdated, false);
		assert.deepEqual(fs.readdirSync(result.folderPath).sort(), ['PROMPT.md', 'STATUS.md']);
		assert.ok(fs.existsSync(path.join(tasksRoot, 'SP-890-hydrate-issue', 'PROMPT.md')));
		assert.ok(!fs.existsSync(path.join(tasksRoot, 'dependencies.json')), 'no dependencies.json edges');

		// Folder-exists guard
		assert.throws(
			() =>
				scaffoldTaskFolder({ tasksRoot, issue: ISSUE_384, linkType: 'closes', slug: 'hydrate-issue' }),
			/already exists/,
		);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test('scaffoldTaskFolder fails loud without CONTEXT Next Task ID unless --id given', () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sp888-noid-'));
	try {
		const tasksRoot = path.join(tmp, 'spine-tasks');
		fs.mkdirSync(tasksRoot, { recursive: true });
		fs.writeFileSync(path.join(tasksRoot, 'CONTEXT.md'), 'no counter here\n', 'utf-8');

		assert.throws(
			() => scaffoldTaskFolder({ tasksRoot, issue: ISSUE_384, linkType: 'closes' }),
			/no `\*\*Next Task ID:\*\*` in .*--id SP-###/,
		);

		const result = scaffoldTaskFolder({ tasksRoot, issue: ISSUE_384, linkType: 'closes', taskId: 'SP-777' });
		assert.equal(result.taskId, 'SP-777');
		assert.equal(readNextTaskId(path.join(tasksRoot, 'CONTEXT.md')), null);

		assert.throws(
			() => scaffoldTaskFolder({ tasksRoot, issue: ISSUE_384, linkType: 'closes', taskId: '../escape' }),
			/Invalid task ID/,
		);
		assert.throws(
			() => scaffoldTaskFolder({ tasksRoot, issue: ISSUE_384, linkType: 'maybe' }),
			/Invalid linkType/,
		);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test('updateNextTaskId rewrites the counter only via explicit opt-in', () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sp888-nextid-'));
	try {
		const contextPath = path.join(tmp, 'CONTEXT.md');
		fs.writeFileSync(contextPath, '# Context\n\n**Next Task ID:** SP-890\n\nkeep me\n', 'utf-8');
		updateNextTaskId(contextPath, 'SP-891');
		const updated = fs.readFileSync(contextPath, 'utf-8');
		assert.match(updated, /\*\*Next Task ID:\*\* SP-891/);
		assert.match(updated, /keep me/);
		assert.throws(() => updateNextTaskId(contextPath, 'not-an-id'), /Invalid --next-id value/);
		assert.throws(() => updateNextTaskId(contextPath, '../escape'), /Invalid --next-id value/);

		fs.writeFileSync(contextPath, 'no counter line\n', 'utf-8');
		assert.throws(() => updateNextTaskId(contextPath, 'SP-892'), /no `\*\*Next Task ID:\*\* PREFIX-###` line/);
		assert.throws(() => updateNextTaskId(path.join(tmp, 'missing.md'), 'SP-892'), /Cannot read CONTEXT\.md/);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test('golden path: scaffold fails validate until operator fills Contract, then passes', async () => {
	const projectRoot = await initGitRepo('sp888-golden-');
	try {
		const ghShim = writeGhShim(path.join(projectRoot, '.spine', 'shim'));

		// Scaffold via the CLI runner (defaults to CONTEXT.md Next Task ID SP-001)
		const scaffold = await runSpineTasksFromIssue({
			projectRoot,
			issueNumber: 384,
			ghCommand: ghShim,
			slug: 'from-issue',
		});
		assert.equal(scaffold.exitCode, 0);
		assert.match(scaffold.output, /Scaffolded SP-001 from issue #384/);
		assert.match(scaffold.output, /Contract: EMPTY/);
		assert.match(scaffold.output, /CONTEXT\.md unchanged/);
		const folderPath = path.join(projectRoot, 'spine-tasks', 'SP-001-from-issue');
		assert.ok(fs.existsSync(path.join(folderPath, 'PROMPT.md')));
		assert.ok(fs.existsSync(path.join(folderPath, 'STATUS.md')));
		assert.ok(!fs.existsSync(path.join(projectRoot, 'spine-tasks', 'dependencies.json')));

		// Validate-after-fill path: scaffold must NOT pass validation
		const before = await runSpineTasksValidate({ projectRoot, scope: 'SP-001' });
		assert.equal(before.exitCode, 1);
		assert.match(before.output, /Contract table is empty/);

		// Operator fills Contract + File Scope
		const promptPath = path.join(folderPath, 'PROMPT.md');
		let md = fs.readFileSync(promptPath, 'utf-8');
		md = md
			.replace('| testCommand |  |', '| testCommand | `true` |')
			.replace('| fileScopeMustChange |  |', '| fileScopeMustChange | `spine-tasks/SP-001-from-issue/PROMPT.md` |')
			.replace(
				/<!-- TODO\(operator\): list files[\s\S]*?-->\n/,
				'- `spine-tasks/SP-001-from-issue/PROMPT.md`\n',
			);
		fs.writeFileSync(promptPath, md, 'utf-8');

		const after = await runSpineTasksValidate({ projectRoot, scope: 'SP-001' });
		assert.equal(after.exitCode, 0, `expected validate pass after fill-in: ${after.output}`);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test('runSpineTasksFromIssue: json payload, --next-id opt-in, and error exit codes', async () => {
	const projectRoot = await initGitRepo('sp888-cli-');
	try {
		const ghShim = writeGhShim(path.join(projectRoot, '.spine', 'shim'));

		// Invalid issue number → config-class error (exit 2)
		await assert.rejects(
			() => runSpineTasksFromIssue({ projectRoot, issueNumber: 0, ghCommand: ghShim }),
			(err) => {
				assert.equal(err.exitCode, 2);
				assert.match(err.message, /Invalid issue number/);
				return true;
			},
		);

		// closes + partial together → usage error
		await assert.rejects(
			() => runSpineTasksFromIssue({ projectRoot, issueNumber: 384, closes: true, partial: true, ghCommand: ghShim }),
			(err) => {
				assert.equal(err.exitCode, 2);
				assert.match(err.message, /only one of --closes \/ --partial/);
				return true;
			},
		);

		// JSON scaffold with explicit --id and --next-id opt-in
		const result = await runSpineTasksFromIssue({
			projectRoot,
			issueNumber: 385,
			partial: true,
			taskId: 'SP-002',
			nextId: 'SP-003',
			ghCommand: ghShim,
			json: true,
		});
		assert.equal(result.exitCode, 0);
		const payload = JSON.parse(result.output);
		assert.deepEqual(payload, {
			taskId: 'SP-002',
			issueNumber: 385,
			missionLink: 'Partial #385',
			folder: 'spine-tasks/SP-002-issue-385-hydrate-packets',
			promptPath: path.join(projectRoot, 'spine-tasks', 'SP-002-issue-385-hydrate-packets', 'PROMPT.md'),
			statusPath: path.join(projectRoot, 'spine-tasks', 'SP-002-issue-385-hydrate-packets', 'STATUS.md'),
			contextNextIdUpdated: true,
		});
		assert.match(
			fs.readFileSync(path.join(projectRoot, 'spine-tasks', 'CONTEXT.md'), 'utf-8'),
			/\*\*Next Task ID:\*\* SP-003/,
		);
		assert.match(
			fs.readFileSync(payload.promptPath, 'utf-8'),
			/## Mission\n\nPartial #385 — /,
		);

		// Duplicate folder → scaffold error (exit 1)
		await assert.rejects(
			() => runSpineTasksFromIssue({ projectRoot, issueNumber: 385, taskId: 'SP-002', ghCommand: ghShim }),
			(err) => {
				assert.equal(err.exitCode, 1);
				assert.match(err.message, /already exists/);
				return true;
			},
		);

		// gh failure → fetch error (exit 1)
		await assert.rejects(
			() =>
				runSpineTasksFromIssue({
					projectRoot,
					issueNumber: 4242,
					taskId: 'SP-004',
					ghCommand: path.join(projectRoot, '.spine', 'shim', 'missing'),
				}),
			(err) => {
				assert.equal(err.exitCode, 1);
				assert.match(err.message, /gh CLI not found on PATH/);
				return true;
			},
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
