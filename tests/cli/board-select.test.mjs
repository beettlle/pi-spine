/**
 * SP-889 — board selection: GitHub label/milestone → pending spine task IDs
 * via Mission `Closes`/`Partial` links (#386).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import test from "node:test";

import {
	buildGhIssueListArgs,
	defaultRunGh,
	extractMissionText,
	filterIssuesByBoard,
	formatBoardIdList,
	parseBoardSelectArgs,
	resolveBoardTaskIds,
	runBoardSelect,
} from "../../src/cli/board-select.mjs";
import { loadSpineConfigTemplate } from "../../src/config/spine-init-constants.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";

/** Stub gh board: #500 labeled wave-a, #501 in milestone v2.35, #502 unlinked. */
const BOARD_ISSUES = [
	{ number: 500, labels: [{ name: "wave-a" }], milestone: null },
	{ number: 501, labels: [], milestone: { number: 7, title: "v2.35" } },
	{ number: 502, labels: [{ name: "wave-b" }], milestone: null },
];

function stubGh() {
	/** @type {string[][]} */
	const calls = [];
	return {
		calls,
		/** @type {(projectRoot: string, args: string[]) => { status: number, stdout: string, stderr: string, error: null }} */
		run(root, args) {
			calls.push(args);
			return { status: 0, stdout: JSON.stringify(BOARD_ISSUES), stderr: "", error: null };
		},
	};
}

/**
 * Fixture tasksRoot:
 *  - SP-901: `Closes #500` (label wave-a) — pending
 *  - SP-902: `Partial #501` (milestone v2.35) — pending
 *  - SP-903: no issue links — pending
 *  - SP-904: `Closes #500` — landed (.DONE)
 *  - SP-905: `Closes: #501, #502` (multi-ref run) — superseded
 *  - SP-906: `Closes #500` — pending, created out of order to prove sorting
 *
 * @param {string} root
 * @returns {string} tasksRoot
 */
function createTasksFixture(root) {
	const tasksRoot = path.join(root, "spine-tasks");
	fs.mkdirSync(tasksRoot, { recursive: true });
	/** @type {Array<[string, string, string | null]>} */
	const tasks = [
		["SP-901", "label-match", "Closes #500."],
		["SP-902", "milestone-partial", "Partial #501."],
		["SP-903", "no-links", "No board links here."],
		["SP-904", "done-label", "Closes #500."],
		["SP-905", "multi-ref", "Closes: #501, #502."],
		["SP-906", "sorted-last", "Closes #500."],
	];
	for (const [taskId, slug, mission] of tasks) {
		const folder = path.join(tasksRoot, `${taskId}-${slug}`);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			minimalValidPromptMarkdown(taskId, { title: slug, fileScope: `src/${slug}.mjs`, mission }),
			"utf-8",
		);
	}
	fs.writeFileSync(path.join(tasksRoot, "SP-904-done-label", ".DONE"), "", "utf-8");
	fs.writeFileSync(path.join(tasksRoot, "SP-905-multi-ref", ".SUPERSEDED"), "Superseded by SP-999", "utf-8");
	return tasksRoot;
}

async function withFixture(fn) {
	const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "spine-board-select-"));
	try {
		return await fn({ root, tasksRoot: createTasksFixture(root) });
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

test("parseBoardSelectArgs: repeatable space-form labels, milestone, print-ids, scope passthrough", () => {
	const parsed = parseBoardSelectArgs([
		"--issue-label",
		"wave-a",
		"--issue-label",
		"wave-b",
		"--milestone",
		"v2.35",
		"--print-ids",
		"TP-001",
	]);
	assert.deepEqual(parsed.labels, ["wave-a", "wave-b"]);
	assert.equal(parsed.milestone, "v2.35");
	assert.equal(parsed.printIds, true);
	assert.deepEqual(parsed.rest, ["TP-001"]);
});

test("parseBoardSelectArgs: equals forms and unknown flag passthrough", () => {
	const parsed = parseBoardSelectArgs(["--issue-label=bug", "--milestone=v2.35", "--json", "SP-001"]);
	assert.deepEqual(parsed.labels, ["bug"]);
	assert.equal(parsed.milestone, "v2.35");
	assert.equal(parsed.printIds, false);
	assert.deepEqual(parsed.rest, ["--json", "SP-001"]);
});

test("parseBoardSelectArgs: no board flags leaves argv untouched", () => {
	const parsed = parseBoardSelectArgs(["pending", "--json"]);
	assert.deepEqual(parsed.labels, []);
	assert.equal(parsed.milestone, null);
	assert.equal(parsed.printIds, false);
	assert.deepEqual(parsed.rest, ["pending", "--json"]);
});

test("parseBoardSelectArgs: flag-looking token is never swallowed as a value", () => {
	const parsed = parseBoardSelectArgs(["--issue-label", "--json"]);
	assert.deepEqual(parsed.labels, []);
	assert.deepEqual(parsed.rest, ["--json"]);
});

test("parseBoardSelectArgs: legacy --github-label is rejected fail-closed (no alias, SP-894)", () => {
	assert.throws(
		() => parseBoardSelectArgs(["--github-label", "wave-a"]),
		(err) => {
			assert.match(err.message, /--github-label/);
			assert.match(err.message, /renamed to --issue-label/);
			assert.equal(err.suggestedCommand, "spine plan --issue-label <label>");
			return true;
		},
	);
	assert.throws(
		() => parseBoardSelectArgs(["--github-label=bug"]),
		/renamed to --issue-label/,
	);
});

test("buildGhIssueListArgs: open issues, bounded limit, JSON field selection", () => {
	assert.deepEqual(buildGhIssueListArgs(), [
		"issue",
		"list",
		"--state",
		"open",
		"--limit",
		"1000",
		"--json",
		"number,labels,milestone",
	]);
});

test("extractMissionText: returns the Mission body; null when the section is absent", () => {
	const markdown = minimalValidPromptMarkdown("SP-001", { mission: "Closes #500." });
	assert.ok(extractMissionText(markdown)?.includes("Closes #500."));
	assert.equal(extractMissionText("# Task: SP-001 — no mission\n\nbody"), null);
	assert.equal(extractMissionText(null), null);
});

test("filterIssuesByBoard: label match is case-insensitive and any-match", () => {
	const matched = filterIssuesByBoard(BOARD_ISSUES, { labels: ["WAVE-A", "wave-b"], milestone: null });
	assert.deepEqual(matched, [500, 502]);
});

test("filterIssuesByBoard: milestone matches by title (case-insensitive) or number", () => {
	assert.deepEqual(filterIssuesByBoard(BOARD_ISSUES, { labels: [], milestone: "V2.35" }), [501]);
	assert.deepEqual(filterIssuesByBoard(BOARD_ISSUES, { labels: [], milestone: "7" }), [501]);
	assert.deepEqual(filterIssuesByBoard(BOARD_ISSUES, { labels: [], milestone: "other" }), []);
});

test("filterIssuesByBoard: label OR milestone (union); no filters → no match", () => {
	const matched = filterIssuesByBoard(BOARD_ISSUES, { labels: ["wave-a"], milestone: "v2.35" });
	assert.deepEqual(matched, [500, 501]);
	assert.deepEqual(filterIssuesByBoard(BOARD_ISSUES, { labels: [], milestone: null }), []);
});

test("resolveBoardTaskIds: label resolves to pending tasks only, sorted", async () => {
	await withFixture(async ({ tasksRoot }) => {
		const gh = stubGh();
		const selection = resolveBoardTaskIds({ tasksRoot, labels: ["wave-a"], milestone: null, runGh: gh.run });
		assert.deepEqual(selection.taskIds, ["SP-901", "SP-906"]);
		assert.equal(selection.boardIssueCount, 1);
		assert.deepEqual(selection.matches, [
			{ taskId: "SP-901", issues: [500] },
			{ taskId: "SP-906", issues: [500] },
		]);
		assert.equal(selection.excludedCount, 2, "SP-904 (.DONE) and SP-905 (.SUPERSEDED) excluded");
		assert.deepEqual(gh.calls, [buildGhIssueListArgs()]);
	});
});

test("resolveBoardTaskIds: milestone resolves partial-linked tasks", async () => {
	await withFixture(async ({ tasksRoot }) => {
		const selection = resolveBoardTaskIds({
			tasksRoot,
			labels: [],
			milestone: "v2.35",
			runGh: stubGh().run,
		});
		assert.deepEqual(selection.taskIds, ["SP-902"]);
	});
});

test("resolveBoardTaskIds: label + milestone is a union of boards", async () => {
	await withFixture(async ({ tasksRoot }) => {
		const selection = resolveBoardTaskIds({
			tasksRoot,
			labels: ["wave-a"],
			milestone: "v2.35",
			runGh: stubGh().run,
		});
		assert.deepEqual(selection.taskIds, ["SP-901", "SP-902", "SP-906"]);
	});
});

test("resolveBoardTaskIds: multi-ref Mission run matches every board issue", async () => {
	await withFixture(async ({ tasksRoot }) => {
		// SP-905 is superseded; use a live multi-ref task instead.
		const tasksRoot2 = path.join(path.dirname(tasksRoot), "spine-tasks-multiref");
		fs.mkdirSync(tasksRoot2, { recursive: true });
		const folder = path.join(tasksRoot2, "SP-907-multi");
		fs.mkdirSync(folder);
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			minimalValidPromptMarkdown("SP-907", { mission: "Closes: #501, #502." }),
			"utf-8",
		);
		const selection = resolveBoardTaskIds({
			tasksRoot: tasksRoot2,
			labels: ["wave-b"],
			milestone: "v2.35",
			runGh: stubGh().run,
		});
		assert.deepEqual(selection.taskIds, ["SP-907"]);
		assert.deepEqual(selection.matches[0].issues.sort((a, b) => a - b), [501, 502]);
	});
});

test("resolveBoardTaskIds: no link match → empty task IDs, exit-0 shape", async () => {
	await withFixture(async ({ tasksRoot }) => {
		const selection = resolveBoardTaskIds({
			tasksRoot,
			labels: ["unmatched-label"],
			milestone: null,
			runGh: stubGh().run,
		});
		assert.deepEqual(selection.taskIds, []);
		assert.equal(selection.boardIssueCount, 0);
	});
});

test("resolveBoardTaskIds: unreadable PROMPT.md lands in readErrors (warn-and-continue)", async () => {
	await withFixture(async ({ tasksRoot }) => {
		const selection = resolveBoardTaskIds({
			tasksRoot,
			labels: ["wave-a"],
			milestone: null,
			runGh: stubGh().run,
			readTextFile: (filePath) => {
				if (filePath.includes("SP-901")) throw new Error("EACCES: denied");
				return fs.readFileSync(filePath, "utf-8");
			},
		});
		assert.deepEqual(selection.taskIds, ["SP-906"]);
		assert.equal(selection.readErrors.length, 1);
		assert.match(selection.readErrors[0], /SP-901: EACCES/);
	});
});

test("resolveBoardTaskIds: missing filters throws with suggestedCommand", () => {
	assert.throws(
		() => resolveBoardTaskIds({ tasksRoot: "/tmp", labels: [], milestone: null, runGh: stubGh().run }),
		(err) => {
			assert.match(err.message, /--issue-label|--milestone/);
			assert.equal(err.suggestedCommand, "spine plan --issue-label <label>");
			return true;
		},
	);
});

test("resolveBoardTaskIds: gh spawn failure throws with auth-status hint", async () => {
	await withFixture(async ({ tasksRoot }) => {
		assert.throws(
			() =>
				resolveBoardTaskIds({
					tasksRoot,
					labels: ["wave-a"],
					milestone: null,
					runGh: () => ({ status: null, stdout: "", stderr: "", error: new Error("spawn gh ENOENT") }),
				}),
			(err) => {
				assert.match(err.message, /gh failed: spawn gh ENOENT/);
				assert.match(err.suggestedCommand, /gh auth status/);
				return true;
			},
		);
	});
});

test("resolveBoardTaskIds: gh non-zero exit throws with gh auth login hint", async () => {
	await withFixture(async ({ tasksRoot }) => {
		assert.throws(
			() =>
				resolveBoardTaskIds({
					tasksRoot,
					labels: ["wave-a"],
					milestone: null,
					runGh: () => ({ status: 4, stdout: "", stderr: "gh: auth required", error: null }),
				}),
			(err) => {
				assert.match(err.message, /gh issue list failed: gh: auth required/);
				assert.match(err.suggestedCommand, /gh auth login/);
				return true;
			},
		);
	});
});

test("resolveBoardTaskIds: unparseable gh JSON throws a parse error", async () => {
	await withFixture(async ({ tasksRoot }) => {
		assert.throws(
			() =>
				resolveBoardTaskIds({
					tasksRoot,
					labels: ["wave-a"],
					milestone: null,
					runGh: () => ({ status: 0, stdout: "not json", stderr: "", error: null }),
				}),
			/gh issue list returned unparseable JSON/,
		);
	});
});

test("resolveBoardTaskIds: resolves tasksRoot from spine config when no override", async () => {
	const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "spine-board-config-"));
	try {
		createTasksFixture(root);
		const spineDir = path.join(root, ".spine");
		fs.mkdirSync(spineDir, { recursive: true });
		fs.writeFileSync(
			path.join(spineDir, "spine-config.json"),
			JSON.stringify(loadSpineConfigTemplate(), null, 2),
			"utf-8",
		);
		const selection = resolveBoardTaskIds({
			projectRoot: root,
			labels: ["wave-a"],
			milestone: null,
			runGh: stubGh().run,
		});
		assert.deepEqual(selection.taskIds, ["SP-901", "SP-906"]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runBoardSelect: printIds emits the raw comma-separated list", async () => {
	await withFixture(async ({ tasksRoot }) => {
		const { output, selection } = await runBoardSelect({
			tasksRoot,
			labels: ["wave-a"],
			milestone: null,
			printIds: true,
			runGh: stubGh().run,
		});
		assert.equal(output, "SP-901,SP-906");
		assert.ok(Array.isArray(selection.taskIds));
	});
});

test("runBoardSelect: human output carries IDs, usage hints, and the non-goal note", async () => {
	await withFixture(async ({ tasksRoot }) => {
		const { output } = await runBoardSelect({
			tasksRoot,
			labels: ["wave-a"],
			milestone: "v2.35",
			runGh: stubGh().run,
		});
		assert.match(output, /SP-901,SP-902,SP-906/);
		assert.match(output, /spine batch start <ids>/);
		assert.match(output, /spine plan/);
		assert.match(output, /never starts batches and never polls GitHub/);
	});
});

test("runBoardSelect: zero-match output is informational with the non-goal note", async () => {
	await withFixture(async ({ tasksRoot }) => {
		const { output } = await runBoardSelect({
			tasksRoot,
			labels: ["unmatched-label"],
			milestone: null,
			runGh: stubGh().run,
		});
		assert.match(output, /Board selection — no match/);
		assert.match(output, /0 pending task\(s\) linked/);
		assert.match(output, /never starts batches and never polls GitHub/);
	});
});

test("runBoardSelect: JSON output is a parseable selection object", async () => {
	await withFixture(async ({ tasksRoot }) => {
		const { output } = await runBoardSelect({
			tasksRoot,
			labels: ["wave-a"],
			milestone: null,
			json: true,
			runGh: stubGh().run,
		});
		const parsed = JSON.parse(output);
		assert.deepEqual(parsed.taskIds, ["SP-901", "SP-906"]);
		assert.equal(parsed.boardIssueCount, 1);
		assert.deepEqual(parsed.filters, { labels: ["wave-a"], milestone: null });
	});
});

test("runBoardSelect: missing filters throws (selection refuses to guess)", async () => {
	await withFixture(async ({ tasksRoot }) => {
		await assert.rejects(
			() => runBoardSelect({ tasksRoot, labels: [], milestone: null, runGh: stubGh().run }),
			/--issue-label|--milestone/,
		);
	});
});

test("formatBoardIdList: empty selection renders an empty string", () => {
	assert.equal(formatBoardIdList([]), "");
});

test("defaultRunGh: ENOENT surfaces as error with null status (no shell involved)", () => {
	const result = defaultRunGh(os.tmpdir(), ["auth", "status", "--hostname", "spine.invalid.example"]);
	if (result.error === null) {
		// gh is installed and reachable; the hostname just fails the call.
		assert.equal(typeof result.status, "number");
	} else {
		assert.equal(result.status, null);
		assert.match(result.error.message, /gh/);
	}
});
