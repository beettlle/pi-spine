import assert from "node:assert/strict";
import test from "node:test";
import {
	buildFinalReviewArtifactPath,
	buildReviewArtifactPath,
	formatReviewTimestamp,
	isReviewTypeRequired,
	normalizeCodeVerdict,
	normalizeFinalVerdict,
	normalizeVerdict,
	parseFinalReviewVerdict,
	parseReviewLevel,
	parseReviewVerdict,
	shouldRunCodeReview,
	shouldRunFinalReview,
} from "../../src/batch/review-shared.mjs";

test("parseReviewLevel reads PROMPT heading", () => {
	const level = parseReviewLevel("## Review Level: 2 (Plan and Code)\n");
	assert.equal(level, 2);
});

test("isReviewTypeRequired follows Taskplane rubric", () => {
	assert.equal(isReviewTypeRequired(0, "plan"), false);
	assert.equal(isReviewTypeRequired(1, "plan"), true);
	assert.equal(isReviewTypeRequired(1, "code"), false);
	assert.equal(isReviewTypeRequired(2, "code"), true);
	assert.equal(isReviewTypeRequired(0, "final"), false);
	assert.equal(isReviewTypeRequired(1, "final"), true);
	assert.equal(isReviewTypeRequired(2, "final"), true);
});

test("formatReviewTimestamp strips separators from ISO time", () => {
	const stamp = formatReviewTimestamp(new Date("2026-06-01T12:30:45.123Z"));
	assert.equal(stamp, "20260601T123045");
});

test("buildReviewArtifactPath uses step-timestamp pattern", () => {
	const date = new Date("2026-06-01T12:30:45.123Z");
	const artifact = buildReviewArtifactPath("/tmp/task", 3, date);
	assert.match(artifact, /\/\.reviews\/3-20260601T123045\.md$/);
});

test("buildFinalReviewArtifactPath uses final-timestamp pattern", () => {
	const date = new Date("2026-06-10T12:00:00.000Z");
	const artifact = buildFinalReviewArtifactPath("/tmp/task", date);
	assert.match(artifact, /\/\.reviews\/final-20260610T120000\.md$/);
});

test("normalizeVerdict maps enums by review type", () => {
	assert.equal(normalizeVerdict("approve", "code"), "APPROVE");
	assert.equal(normalizeVerdict("pass", "final"), "PASS");
	assert.equal(normalizeVerdict("replan", "final"), "REPLAN");
	assert.equal(normalizeVerdict("pass", "code"), null);
});

test("normalizeFinalVerdict and normalizeCodeVerdict are type-specific aliases", () => {
	assert.equal(normalizeFinalVerdict("REVISE"), "REVISE");
	assert.equal(normalizeFinalVerdict("APPROVE"), null);
	assert.equal(normalizeCodeVerdict("APPROVE"), "APPROVE");
	assert.equal(normalizeCodeVerdict("PASS"), null);
});

test("parseReviewVerdict reads JSON and markdown verdicts", () => {
	const jsonVerdict = parseReviewVerdict(
		"### Verdict: APPROVE\n```json\n{\"verdict\":\"APPROVE\",\"feedback\":\"ok\"}\n```\n",
	);
	assert.equal(jsonVerdict.verdict, "APPROVE");
	assert.equal(jsonVerdict.feedback, "ok");

	const revise = parseReviewVerdict("### Verdict: REVISE\n### Summary\nFix tests.\n");
	assert.equal(revise.verdict, "REVISE");
	assert.match(revise.feedback, /Fix tests/);
});

test("parseReviewVerdict accepts PASS REVISE REPLAN when reviewType is final", () => {
	const passJson = parseReviewVerdict(
		"```json\n{\"verdict\":\"PASS\",\"feedback\":\"ship it\"}\n```\n",
		{ reviewType: "final" },
	);
	assert.equal(passJson.verdict, "PASS");
	assert.equal(passJson.feedback, "ship it");

	const replan = parseReviewVerdict(
		"### Verdict: REPLAN\n```json\n{\"verdict\":\"REPLAN\",\"feedback\":\"wrong contract\"}\n```\n",
		{ reviewType: "final" },
	);
	assert.equal(replan.verdict, "REPLAN");
	assert.equal(replan.feedback, "wrong contract");
});

test("parseReviewVerdict step mode rejects final-only verdict enums", () => {
	const passAttempt = parseReviewVerdict(
		"```json\n{\"verdict\":\"PASS\",\"feedback\":\"nope\"}\n```\n",
		{ reviewType: "code" },
	);
	assert.equal(passAttempt.verdict, null);

	const replanAttempt = parseReviewVerdict("### Verdict: REPLAN\n", { reviewType: "plan" });
	assert.equal(replanAttempt.verdict, null);
});

test("parseFinalReviewVerdict accepts PASS, REVISE, and REPLAN", () => {
	const pass = parseFinalReviewVerdict(
		"### Verdict: PASS\n```json\n{\"verdict\":\"PASS\",\"feedback\":\"ok\"}\n```\n",
	);
	assert.equal(pass.verdict, "PASS");
	assert.equal(pass.feedback, "ok");

	const replan = parseFinalReviewVerdict("### Verdict: REPLAN\n### Summary\nEdit PROMPT.\n");
	assert.equal(replan.verdict, "REPLAN");
	assert.equal(replan.feedback, "");
});

test("parseFinalReviewVerdict omits heading summary unlike parseReviewVerdict", () => {
	const engineStyle = parseFinalReviewVerdict("### Verdict: REVISE\n### Summary\nTighten scope.\n");
	assert.equal(engineStyle.verdict, "REVISE");
	assert.equal(engineStyle.feedback, "");

	const workerStyle = parseReviewVerdict("### Verdict: REVISE\n### Summary\nTighten scope.\n", {
		reviewType: "final",
	});
	assert.equal(workerStyle.verdict, "REVISE");
	assert.match(workerStyle.feedback, /Tighten scope/);
});

test("parseReviewVerdict reads fence-wrapped JSON after a prose preamble", () => {
	const result = parseReviewVerdict(
		"I reviewed the changes and have notes below.\n\n```json\n{\"verdict\":\"REVISE\",\"feedback\":\"fix x\"}\n```\n",
	);
	assert.equal(result.verdict, "REVISE");
	assert.equal(result.feedback, "fix x");
});

test("parseReviewVerdict fails closed when a json fence holds an embedded extra object", () => {
	const result = parseReviewVerdict('```json\n{"verdict":"APPROVE"} {"extra":true}\n```\n');
	assert.equal(result.verdict, null);
});

test("parseReviewVerdict fails closed when a json fence has trailing prose", () => {
	const result = parseReviewVerdict('```json\n{"verdict":"APPROVE"}\nNote: ship it\n```\n');
	assert.equal(result.verdict, null);
});

test("parseReviewVerdict fails closed on same-line and unclosed json fences", () => {
	const sameLine = parseReviewVerdict('```json {"verdict":"APPROVE","feedback":"ok"}\n```\n');
	assert.equal(sameLine.verdict, null);

	const unclosed = parseReviewVerdict('```json\n{"verdict":"APPROVE","feedback":"ok"}\n');
	assert.equal(unclosed.verdict, null);
});

test("parseReviewVerdict still honors a valid heading when the json fence is malformed", () => {
	const result = parseReviewVerdict(
		'### Verdict: REVISE\n### Summary\nFix tests.\n```json\n{"verdict":"APPROVE"} trailing junk\n```\n',
	);
	assert.equal(result.verdict, "REVISE");
	assert.match(result.feedback, /Fix tests/);
});

test("parseFinalReviewVerdict fails closed on malformed json fences", () => {
	const extraObject = parseFinalReviewVerdict('```json\n{"verdict":"PASS"} {"extra":true}\n```\n');
	assert.equal(extraObject.verdict, null);

	const trailingProse = parseFinalReviewVerdict('```json\n{"verdict":"PASS"}\nNote: ship it\n```\n');
	assert.equal(trailingProse.verdict, null);

	const preambleFence = parseFinalReviewVerdict(
		'Final review notes.\n```json\n{"verdict":"PASS","feedback":"ok"}\n```\n',
	);
	assert.equal(preambleFence.verdict, "PASS");
	assert.equal(preambleFence.feedback, "ok");
});

test("both parsers keep verdict null on unstructured garbage", () => {
	const garbage = "asdf qwer zxcv nothing structured\n";
	assert.equal(parseReviewVerdict(garbage).verdict, null);
	assert.equal(parseFinalReviewVerdict(garbage).verdict, null);
});

test("shouldRunCodeReview requires review level 2 or higher", () => {
	assert.equal(shouldRunCodeReview({ reviewLevel: 0 }), false);
	assert.equal(shouldRunCodeReview({ reviewLevel: 1 }), false);
	assert.equal(shouldRunCodeReview({ reviewLevel: 2 }), true);
	assert.equal(shouldRunCodeReview({ reviewLevel: 3 }), true);
});

test("shouldRunFinalReview skips when review level is 0", () => {
	assert.equal(shouldRunFinalReview({ config: {}, reviewLevel: 0 }), false);
	assert.equal(shouldRunFinalReview({ config: {}, reviewLevel: 1 }), true);
	assert.equal(
		shouldRunFinalReview({ config: { review: { requireFinalVerdict: false } }, reviewLevel: 2 }),
		false,
	);
});
