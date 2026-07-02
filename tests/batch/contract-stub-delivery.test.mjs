import assert from "node:assert/strict";
import test from "node:test";

import {
	isDeliveryArtifactPath,
	isImplementationScopePattern,
	isStubDeliveryOnlyScope,
} from "../../src/batch/contract-stub-delivery.mjs";

test("isDeliveryArtifactPath accepts STATUS.md-only patterns", () => {
	assert.equal(isDeliveryArtifactPath("spine-tasks/*/STATUS.md"), true);
	assert.equal(
		isDeliveryArtifactPath("spine-tasks/SP-407-stub-delivery-scope-detector/STATUS.md"),
		true,
	);
});

test("isDeliveryArtifactPath accepts .DONE-only patterns", () => {
	assert.equal(isDeliveryArtifactPath("spine-tasks/*/.DONE"), true);
	assert.equal(isDeliveryArtifactPath("spine-tasks/SP-407-stub-delivery-scope-detector/.DONE"), true);
	assert.equal(isDeliveryArtifactPath(".DONE"), true);
});

test("isDeliveryArtifactPath accepts task-folder delivery globs", () => {
	assert.equal(
		isDeliveryArtifactPath("spine-tasks/SP-407-stub-delivery-scope-detector/**"),
		true,
	);
	assert.equal(
		isDeliveryArtifactPath("spine-tasks/SP-407-stub-delivery-scope-detector/.reviews/final.md"),
		true,
	);
});

test("isDeliveryArtifactPath rejects implementation and tasks-root paths", () => {
	assert.equal(isDeliveryArtifactPath("src/batch/contract-stub-delivery.mjs"), false);
	assert.equal(isDeliveryArtifactPath("bin/spine-worker-runner.mjs"), false);
	assert.equal(isDeliveryArtifactPath("tests/batch/contract-stub-delivery.test.mjs"), false);
	assert.equal(isDeliveryArtifactPath("spine-tasks/CONTEXT.md"), false);
	assert.equal(isDeliveryArtifactPath("spine-tasks/SP-407-stub-delivery-scope-detector"), false);
});

test("isImplementationScopePattern detects source and tooling roots", () => {
	assert.equal(isImplementationScopePattern("src/feature.mjs"), true);
	assert.equal(isImplementationScopePattern("bin/spine.mjs"), true);
	assert.equal(isImplementationScopePattern("tests/batch/foo.test.mjs"), true);
	assert.equal(isImplementationScopePattern("package.json"), true);
	assert.equal(isImplementationScopePattern("spine-tasks/SP-407/STATUS.md"), false);
});

test("isStubDeliveryOnlyScope is true for delivery-only pattern sets", () => {
	assert.equal(
		isStubDeliveryOnlyScope(["spine-tasks/SP-407-stub-delivery-scope-detector/STATUS.md"]),
		true,
	);
	assert.equal(isStubDeliveryOnlyScope(["spine-tasks/SP-407-stub-delivery-scope-detector/.DONE"]), true);
	assert.equal(
		isStubDeliveryOnlyScope([
			"spine-tasks/SP-407-stub-delivery-scope-detector/STATUS.md",
			"spine-tasks/SP-407-stub-delivery-scope-detector/.DONE",
		]),
		true,
	);
	assert.equal(
		isStubDeliveryOnlyScope(["spine-tasks/SP-407-stub-delivery-scope-detector/**"]),
		true,
	);
});

test("isStubDeliveryOnlyScope rejects mixed implementation and delivery patterns", () => {
	assert.equal(
		isStubDeliveryOnlyScope([
			"spine-tasks/SP-407-stub-delivery-scope-detector/STATUS.md",
			"src/batch/contract-stub-delivery.mjs",
		]),
		false,
	);
	assert.equal(isStubDeliveryOnlyScope(["src/batch/contract-stub-delivery.mjs"]), false);
});

test("isStubDeliveryOnlyScope rejects empty pattern lists", () => {
	assert.equal(isStubDeliveryOnlyScope([]), false);
});

test("isDeliveryArtifactPath honors custom tasksRoot", () => {
	const tasksRoot = "custom-tasks";
	assert.equal(isDeliveryArtifactPath("custom-tasks/SP-900/STATUS.md", tasksRoot), true);
	assert.equal(isDeliveryArtifactPath("spine-tasks/SP-900/STATUS.md", tasksRoot), false);
});
