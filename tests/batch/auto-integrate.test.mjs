import assert from "node:assert/strict";
import test from "node:test";
import { shouldAutoIntegrateAfterWave } from "../../src/batch/engine-scope.mjs";

test("shouldAutoIntegrateAfterWave is false by default", () => {
	assert.equal(
		shouldAutoIntegrateAfterWave({ config: {}, waveIndex: 0, totalWaves: 2 }),
		false,
	);
});

test("shouldAutoIntegrateAfterWave is true when configured and not last wave", () => {
	assert.equal(
		shouldAutoIntegrateAfterWave({
			config: { lanes: { autoIntegrateBetweenWaves: true } },
			waveIndex: 0,
			totalWaves: 2,
		}),
		true,
	);
});

test("shouldAutoIntegrateAfterWave is false on last wave", () => {
	assert.equal(
		shouldAutoIntegrateAfterWave({
			config: { lanes: { autoIntegrateBetweenWaves: true } },
			waveIndex: 1,
			totalWaves: 2,
		}),
		false,
	);
});
