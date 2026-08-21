/**
 * SP-712 — Doctor ETIMEDOUT on `pi --list-models` is advisory (GitHub #256).
 *
 * A slow model catalog fetch must not hard-fail doctor/preflight or suggest
 * `pi login`; genuine auth / no-models failures stay hard fails (#97).
 */

import assert from "node:assert/strict";
import test from "node:test";

import { checkModelProvider } from "../../src/doctor/run-doctor-checks.mjs";

const piInstalled = () => true;

function etimedoutError() {
	return Object.assign(new Error("spawnSync pi ETIMEDOUT"), { code: "ETIMEDOUT" });
}

test("ETIMEDOUT on spawn result is advisory warning, not hard fail (#256)", () => {
	const check = checkModelProvider({
		commandExistsFn: piInstalled,
		spawn: () => ({ error: etimedoutError(), status: null, stdout: "", stderr: "" }),
	});
	assert.equal(check.ok, true);
	assert.equal(check.warning, true);
	assert.match(check.detail, /timed out/i);
	assert.equal(check.suggestedCommand, "retry spine doctor");
	assert.doesNotMatch(check.suggestedCommand, /pi login/);
});

test("ETIMEDOUT thrown by spawn is advisory warning", () => {
	const check = checkModelProvider({
		commandExistsFn: piInstalled,
		spawn: () => {
			throw etimedoutError();
		},
	});
	assert.equal(check.ok, true);
	assert.equal(check.warning, true);
	assert.match(check.detail, /timed out/i);
	assert.doesNotMatch(check.suggestedCommand ?? "", /pi login/);
});

test("advisory timeout row does not count as a doctor issue (preflight-safe)", () => {
	// Preflight fails on any `!entry.ok` row (spine-preflight-lib checkDoctor);
	// an advisory timeout must keep ok:true so issueCount stays unchanged.
	const check = checkModelProvider({
		commandExistsFn: piInstalled,
		spawn: () => ({ error: etimedoutError(), status: null, stdout: "", stderr: "" }),
	});
	assert.equal(check.ok, true, "advisory rows keep ok:true so preflight does not fail");
});

test("non-timeout spawn error stays hard fail with pi login", () => {
	const check = checkModelProvider({
		commandExistsFn: piInstalled,
		spawn: () => ({
			error: Object.assign(new Error("spawnSync pi ENOENT"), { code: "ENOENT" }),
			status: null,
			stdout: "",
			stderr: "",
		}),
	});
	assert.equal(check.ok, false);
	assert.equal(check.warning, undefined);
	assert.equal(check.suggestedCommand, "pi login");
});

test("no models in output stays hard fail with pi login (auth, #97)", () => {
	const check = checkModelProvider({
		commandExistsFn: piInstalled,
		spawn: () => ({ status: 0, stdout: "", stderr: "" }),
	});
	assert.equal(check.ok, false);
	assert.match(check.detail, /no models available/);
	assert.equal(check.suggestedCommand, "pi login");
});

test("valid model catalog output passes without warning", () => {
	const check = checkModelProvider({
		commandExistsFn: piInstalled,
		spawn: () => ({
			status: 0,
			stdout: "provider  model\ngoogle   gemini-3.1-pro-preview\n",
			stderr: "",
		}),
	});
	assert.equal(check.ok, true);
	assert.equal(check.warning, undefined);
	assert.equal(check.detail, "google/gemini-3.1-pro-preview");
});

test("pi not installed stays hard fail without pi login suggestion", () => {
	const check = checkModelProvider({
		commandExistsFn: () => false,
		spawn: () => {
			throw new Error("spawn must not run when pi is missing");
		},
	});
	assert.equal(check.ok, false);
	assert.equal(check.detail, "pi not installed");
	assert.equal(check.suggestedCommand, "https://pi.dev");
});
