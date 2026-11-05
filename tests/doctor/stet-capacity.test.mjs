import assert from "node:assert/strict";
import test from "node:test";

import {
	buildStetCapacityDoctorCheck,
	buildStetVersionDoctorCheck,
	parseDarwinSwapFreeBytes,
	parseLinuxSwapFreeBytes,
	parseLmsLoadedModels,
	parseStetVersion,
} from "../../src/doctor/stet-capacity.mjs";

const GIB = 1024 ** 3;

/** @param {Partial<import("../../src/doctor/stet-capacity.mjs").DEFAULT_STET_CAPACITY_PROBES>} overrides */
function healthyProbes(overrides = {}) {
	return {
		stetOnPath: () => true,
		stetSessionPids: () => [],
		spineBatchPids: () => [],
		swapFreeBytes: () => 8 * GIB,
		loadedModels: () => [{ id: "small", sizeBytes: 4 * GIB }],
		totalMemBytes: () => 64 * GIB,
		...overrides,
	};
}

test("parses macOS sysctl vm.swapusage free MiB", () => {
	const text = "vm.swapusage: total = 22528.00M  used = 21370.00M  free = 1158.00M  (encrypted)";
	assert.equal(parseDarwinSwapFreeBytes(text), 1158 * 1024 * 1024);
	assert.equal(parseDarwinSwapFreeBytes("garbage"), null);
});

test("parses Linux /proc/meminfo swap and treats no-swap hosts as unknown", () => {
	assert.equal(parseLinuxSwapFreeBytes("SwapTotal: 2048 kB\nSwapFree: 1024 kB\n"), 1024 * 1024);
	assert.equal(parseLinuxSwapFreeBytes("SwapTotal: 0 kB\nSwapFree: 0 kB\n"), null);
});

test("parses lms ps --json loaded models", () => {
	const text = JSON.stringify([{ identifier: "qwen/qwen3.8-27b", sizeBytes: 16081678492 }]);
	assert.deepEqual(parseLmsLoadedModels(text), [{ id: "qwen/qwen3.8-27b", sizeBytes: 16081678492 }]);
	assert.equal(parseLmsLoadedModels("not json"), null);
});

test("skips when stet is not installed", () => {
	const check = buildStetCapacityDoctorCheck({ probes: healthyProbes({ stetOnPath: () => false }) });
	assert.equal(check.ok, true);
	assert.equal(check.warning, undefined);
	assert.match(check.detail, /skipped/);
});

test("healthy host passes without warning", () => {
	const check = buildStetCapacityDoctorCheck({ probes: healthyProbes() });
	assert.equal(check.warning, undefined);
	assert.match(check.detail, /headroom/);
});

test("warns on concurrent stet, concurrent batch, low swap, and oversized models together", () => {
	const check = buildStetCapacityDoctorCheck({
		probes: healthyProbes({
			stetSessionPids: () => [111],
			spineBatchPids: () => [222],
			swapFreeBytes: () => GIB,
			loadedModels: () => [{ id: "big", sizeBytes: 40 * GIB }],
		}),
	});
	assert.equal(check.ok, true);
	assert.equal(check.warning, true);
	assert.match(check.detail, /stet review already running \(pid 111\)/);
	assert.match(check.detail, /other spine batch running \(pid 222\)/);
	assert.match(check.detail, /swap nearly exhausted \(1\.0 GiB free\)/);
	assert.match(check.detail, /LM Studio models use 40\.0 GiB of 64\.0 GiB RAM \(big\)/);
	assert.match(check.suggestedCommand ?? "", /lms unload --all/);
});

test("unavailable probes are reported, not treated as healthy or failing", () => {
	const check = buildStetCapacityDoctorCheck({
		probes: healthyProbes({ stetSessionPids: () => null, loadedModels: () => null }),
	});
	assert.equal(check.warning, undefined);
	assert.match(check.detail, /not probed: stet processes, LM Studio models/);
});

const INSTALL = "curl -fsSL https://raw.githubusercontent.com/beettlle/stet/main/install.sh | bash";

function stetVersionCheck(output) {
	return buildStetVersionDoctorCheck({ stetVersion: () => output });
}

test("parses stet --version output numerically", () => {
	assert.deepEqual(parseStetVersion("stet version v1.4.0"), { major: 1, minor: 4, patch: 0 });
	assert.deepEqual(parseStetVersion("stet version v1.10.0\nbuild 2f4086"), { major: 1, minor: 10, patch: 0 });
	assert.equal(parseStetVersion("no version here"), null);
});

test("version check skips when stet is not on PATH", () => {
	const check = stetVersionCheck(null);
	assert.equal(check.ok, true);
	assert.equal(check.warning, undefined);
	assert.equal(check.detail, "stet not on PATH (skipped)");
});

test("version check passes for stet v1.4.0 and v1.10.0 (numeric compare)", () => {
	const atFloor = stetVersionCheck("stet version v1.4.0");
	assert.equal(atFloor.ok, true);
	assert.equal(atFloor.warning, undefined);
	assert.equal(atFloor.detail, "stet v1.4.0");
	const newer = stetVersionCheck("stet version v1.10.0");
	assert.equal(newer.ok, true);
	assert.equal(newer.warning, undefined);
	assert.equal(newer.detail, "stet v1.10.0");
});

test("version check warns (never fails) for stet v1.3.0", () => {
	const check = stetVersionCheck("stet version v1.3.0");
	assert.equal(check.ok, true);
	assert.equal(check.warning, true);
	assert.match(check.detail, /stet version v1\.3\.0/);
	assert.match(check.detail, /falls back to gating on every active finding/);
	assert.equal(check.suggestedCommand, INSTALL);
});

test("version check warns on unparseable output", () => {
	const check = stetVersionCheck("stet: command produced nonsense");
	assert.equal(check.ok, true);
	assert.equal(check.warning, true);
	assert.match(check.detail, /command produced nonsense/);
	assert.match(check.detail, /falls back to gating on every active finding/);
	assert.equal(check.suggestedCommand, INSTALL);
});
