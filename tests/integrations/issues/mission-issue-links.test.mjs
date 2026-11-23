import assert from "node:assert/strict";
import test from "node:test";

import {
	parseMissionIssueLinks,
	issueLinkActions,
} from "../../../src/integrations/issues/mission-issue-links.mjs";

// Format rules from #147: `Closes #N` fully resolves; `Partial #N` is one of
// several tasks addressing the issue; colon optional, first line of Mission.

test("parses bare Closes #N", () => {
	assert.deepEqual(parseMissionIssueLinks("Closes #383"), { closes: [383], partial: [] });
});

test("parses colon form Closes: #N (SP-434 style)", () => {
	assert.deepEqual(parseMissionIssueLinks("Closes: #89"), { closes: [89], partial: [] });
});

test("parses Partial #N and Partial: #N", () => {
	assert.deepEqual(parseMissionIssueLinks("Partial #382"), { closes: [], partial: [382] });
	assert.deepEqual(parseMissionIssueLinks("Partial: #105"), { closes: [], partial: [105] });
});

test("keyword match is case-insensitive", () => {
	assert.deepEqual(parseMissionIssueLinks("CLOSES #12"), { closes: [12], partial: [] });
	assert.deepEqual(parseMissionIssueLinks("closes: #12"), { closes: [12], partial: [] });
	assert.deepEqual(parseMissionIssueLinks("PARTIAL #13"), { closes: [], partial: [13] });
});

test("collects multiple comma-separated refs after one keyword", () => {
	assert.deepEqual(parseMissionIssueLinks("Closes #1, #2, #3"), {
		closes: [1, 2, 3],
		partial: [],
	});
});

test("collects space- and semicolon-separated refs", () => {
	assert.deepEqual(parseMissionIssueLinks("Closes #1 #2; #3"), {
		closes: [1, 2, 3],
		partial: [],
	});
});

test("dedupes repeated refs", () => {
	assert.deepEqual(parseMissionIssueLinks("Closes #7 and again Closes #7"), {
		closes: [7],
		partial: [],
	});
});

test("splits closes and partial lists", () => {
	const links = parseMissionIssueLinks("Closes #10, #11. Partial #99");
	assert.deepEqual(links.closes, [10, 11]);
	assert.deepEqual(links.partial, [99]);
});

test("an issue in both lists resolves to closes (#383 AC: no double action)", () => {
	const links = parseMissionIssueLinks("Closes #5. Partial #5");
	assert.deepEqual(links.closes, [5]);
	assert.deepEqual(links.partial, []);
});

test("does not match embedded keywords (Encloses, Partials)", () => {
	assert.deepEqual(parseMissionIssueLinks("Encloses #5"), { closes: [], partial: [] });
	assert.deepEqual(parseMissionIssueLinks("Partials #5"), { closes: [], partial: [] });
});

test("does not match non-numeric or prose refs", () => {
	assert.deepEqual(parseMissionIssueLinks("Closes #abc"), { closes: [], partial: [] });
	assert.deepEqual(parseMissionIssueLinks("Closes the gap"), { closes: [], partial: [] });
	assert.deepEqual(parseMissionIssueLinks("closes"), { closes: [], partial: [] });
});

test("ignores refs in unrelated sentences", () => {
	assert.deepEqual(parseMissionIssueLinks("See #382 for context and parent epic"), {
		closes: [],
		partial: [],
	});
});

test("empty and null input yield empty lists", () => {
	assert.deepEqual(parseMissionIssueLinks(""), { closes: [], partial: [] });
	assert.deepEqual(parseMissionIssueLinks(null), { closes: [], partial: [] });
	assert.deepEqual(parseMissionIssueLinks(undefined), { closes: [], partial: [] });
});

test("parses from a full Mission section block", () => {
	const mission = [
		"Closes #383, Partial #382 — After a linked task's `.DONE` is on the batch",
		"base (post-integrate success), optionally comment on and close GitHub",
		"issues from Mission `Closes #N` / `Partial #N`.",
	].join("\n");
	const links = parseMissionIssueLinks(mission);
	assert.deepEqual(links.closes, [383]);
	assert.deepEqual(links.partial, [382]);
});

test("issueLinkActions flattens closes before partial", () => {
	const actions = issueLinkActions({ closes: [3], partial: [9, 1] });
	assert.deepEqual(actions, [
		{ issue: 3, action: "close" },
		{ issue: 9, action: "comment" },
		{ issue: 1, action: "comment" },
	]);
});

test("issueLinkActions tolerates null input", () => {
	assert.deepEqual(issueLinkActions(null), []);
});
