import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const gateScript = path.join(repoRoot, "scripts/release-proof-gate.sh");

/**
 * @param {string} mockBin
 * @param {{ doctorExit?: number, preflightExit?: number, gitnexusStatus?: string }} opts
 */
function writeMockBinaries(mockBin, opts = {}) {
	const doctorExit = opts.doctorExit ?? 0;
	const preflightExit = opts.preflightExit ?? 0;
	const gitnexusStatus = opts.gitnexusStatus ?? "Status: up-to-date";

	mkdirSync(mockBin, { recursive: true });

	const mockSpine = `#!/bin/bash
set -euo pipefail
case "\${1:-}" in
doctor)
  exit ${doctorExit}
  ;;
preflight)
  exit ${preflightExit}
  ;;
*)
  echo "mock spine: unknown command \$1" >&2
  exit 127
  ;;
esac
`;
	writeFileSync(path.join(mockBin, "spine"), mockSpine, "utf-8");
	chmodSync(path.join(mockBin, "spine"), 0o755);

	const mockGitnexus = `#!/bin/bash
set -euo pipefail
case "\${1:-}" in
status)
  echo "${gitnexusStatus.replace(/"/g, '\\"')}"
  exit 0
  ;;
*)
  echo "mock gitnexus: unknown command \$1" >&2
  exit 127
  ;;
esac
`;
	writeFileSync(path.join(mockBin, "gitnexus"), mockGitnexus, "utf-8");
	chmodSync(path.join(mockBin, "gitnexus"), 0o755);

	const mockGh = `#!/bin/bash
set -euo pipefail
if [[ "\${1:-}" == "issue" && "\${2:-}" == "list" ]]; then
  echo "0"
  exit 0
fi
echo "mock gh: unsupported args" >&2
exit 127
`;
	writeFileSync(path.join(mockBin, "gh"), mockGh, "utf-8");
	chmodSync(path.join(mockBin, "gh"), 0o755);
}

/**
 * @param {string} root
 * @param {{ includeV210?: boolean, includeV220?: boolean, includeV230?: boolean, includeProof?: boolean }} opts
 */
function seedRepoLayout(root, opts = {}) {
	const includeV210 = opts.includeV210 ?? false;
	const includeV220 = opts.includeV220 ?? false;
	const includeV230 = opts.includeV230 ?? true;
	const includeProof = opts.includeProof ?? false;

	mkdirSync(path.join(root, ".spine"), { recursive: true });
	writeFileSync(path.join(root, ".spine/spine-config.json"), "{}\n", "utf-8");
	mkdirSync(path.join(root, "docs/release"), { recursive: true });
	writeFileSync(
		path.join(root, "docs/release/automation-signoff-checklist.md"),
		"# signoff\n",
		"utf-8",
	);
	if (includeProof) {
		writeFileSync(path.join(root, "docs/release/manifest-v2.0.0-proof.md"), "# manifest\n", "utf-8");
	}
	if (includeV210) {
		writeFileSync(path.join(root, "docs/release/manifest-v2.1.0.md"), "# manifest\n", "utf-8");
		writeFileSync(path.join(root, "docs/PRD-v2.1.0-backlog-drain-handoff.md"), "# handoff\n", "utf-8");
	}
	if (includeV220) {
		writeFileSync(path.join(root, "docs/release/manifest-v2.2.0.md"), "# manifest\n", "utf-8");
		writeFileSync(path.join(root, "docs/PRD-v2.2.0-backlog-drain-handoff.md"), "# handoff\n", "utf-8");
	}
	if (includeV230) {
		writeFileSync(path.join(root, "docs/release/manifest-v2.3.0.md"), "# manifest\n", "utf-8");
		writeFileSync(path.join(root, "docs/PRD-v2.3.0-module-split-handoff.md"), "# handoff\n", "utf-8");
	}
}

/**
 * @param {string} root
 * @param {Record<string, string | undefined>} env
 */
function runGate(root, env = {}) {
	return execFileSync("bash", [gateScript], {
		cwd: root,
		env: { ...process.env, ...env },
		encoding: "utf8",
	});
}

/**
 * @param {string} root
 * @param {Record<string, string | undefined>} env
 */
function runGateExpectFail(root, env = {}) {
	try {
		execFileSync("bash", [gateScript], {
			cwd: root,
			env: { ...process.env, ...env },
			encoding: "utf8",
		});
		return { status: 0, stdout: "", stderr: "" };
	} catch (error) {
		const execError = /** @type {NodeJS.ErrnoException & { status?: number, stdout?: string, stderr?: string }} */ (
			error
		);
		return {
			status: execError.status ?? 1,
			stdout: execError.stdout ?? "",
			stderr: execError.stderr ?? "",
		};
	}
}

/** @param {string} root @param {Record<string, string | undefined>} env */
function mockEnv(root, mockBin, extra = {}) {
	return {
		RELEASE_PROOF_GATE_ROOT: root,
		SPINE_BIN: path.join(mockBin, "spine"),
		GITNEXUS_BIN: path.join(mockBin, "gitnexus"),
		PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
		...extra,
	};
}

test("gate script passes bash -n syntax check", () => {
	execFileSync("bash", ["-n", gateScript], { encoding: "utf8" });
});

test("v2.3.0 default: all blocking checks pass with mocked spine/gitnexus", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "release-proof-gate-pass-"));
	const mockBin = path.join(root, "bin");
	writeMockBinaries(mockBin);
	seedRepoLayout(root);
	try {
		const stdout = runGate(root, mockEnv(root, mockBin));
		assert.match(stdout, /All blocking checks passed/);
		assert.match(stdout, /spine doctor\s+PASS/);
		assert.match(stdout, /v2\.3\.0 release manifest\s+PASS/);
		assert.match(stdout, /handoff PRD\s+PASS/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("v2.2.0 explicit: all blocking checks pass with mocked spine/gitnexus", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "release-proof-gate-v220-pass-"));
	const mockBin = path.join(root, "bin");
	writeMockBinaries(mockBin);
	seedRepoLayout(root, { includeV220: true, includeV230: false });
	try {
		const stdout = runGate(root, mockEnv(root, mockBin, { RELEASE_GATE_VERSION: "2.2.0" }));
		assert.match(stdout, /All blocking checks passed/);
		assert.match(stdout, /v2\.2\.0 release manifest\s+PASS/);
		assert.match(stdout, /handoff PRD\s+PASS/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("v2.1.0 explicit: all blocking checks pass with mocked spine/gitnexus", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "release-proof-gate-v210-pass-"));
	const mockBin = path.join(root, "bin");
	writeMockBinaries(mockBin);
	seedRepoLayout(root, { includeV210: true, includeV220: false, includeV230: false });
	try {
		const stdout = runGate(root, mockEnv(root, mockBin, { RELEASE_GATE_VERSION: "2.1.0" }));
		assert.match(stdout, /All blocking checks passed/);
		assert.match(stdout, /v2\.1\.0 release manifest\s+PASS/);
		assert.match(stdout, /handoff PRD\s+PASS/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("fails when spine doctor fails", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "release-proof-gate-doctor-"));
	const mockBin = path.join(root, "bin");
	writeMockBinaries(mockBin, { doctorExit: 1 });
	seedRepoLayout(root);
	try {
		const result = runGateExpectFail(root, mockEnv(root, mockBin));
		assert.equal(result.status, 1);
		assert.match(result.stderr, /spine doctor failed/);
		assert.match(result.stdout + result.stderr, /1 blocking check\(s\) failed/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("fails when gitnexus index is stale unless skipped", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "release-proof-gate-stale-"));
	const mockBin = path.join(root, "bin");
	writeMockBinaries(mockBin, { gitnexusStatus: "Status: ⚠️ stale (re-run gitnexus analyze)" });
	seedRepoLayout(root);
	try {
		const failResult = runGateExpectFail(root, mockEnv(root, mockBin));
		assert.equal(failResult.status, 1);
		assert.match(failResult.stderr, /gitnexus index stale/);

		const passStdout = runGate(root, mockEnv(root, mockBin, { SPINE_PROOF_SKIP_GITNEXUS: "1" }));
		assert.match(passStdout, /gitnexus status\s+SKIP/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("fails when v2.1.0 release manifest is missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "release-proof-gate-manifest-"));
	const mockBin = path.join(root, "bin");
	writeMockBinaries(mockBin);
	seedRepoLayout(root, { includeV210: true, includeV220: false, includeV230: false });
	fs.unlinkSync(path.join(root, "docs/release/manifest-v2.1.0.md"));
	try {
		const result = runGateExpectFail(root, mockEnv(root, mockBin, { RELEASE_GATE_VERSION: "2.1.0" }));
		assert.equal(result.status, 1);
		assert.match(result.stderr, /missing v2\.1\.0 release manifest/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("fails when v2.3.0 release manifest is missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "release-proof-gate-manifest-v230-"));
	const mockBin = path.join(root, "bin");
	writeMockBinaries(mockBin);
	seedRepoLayout(root);
	fs.unlinkSync(path.join(root, "docs/release/manifest-v2.3.0.md"));
	try {
		const result = runGateExpectFail(root, mockEnv(root, mockBin));
		assert.equal(result.status, 1);
		assert.match(result.stderr, /missing v2\.3\.0 release manifest/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("fails when v2.2.0 release manifest is missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "release-proof-gate-manifest-v220-"));
	const mockBin = path.join(root, "bin");
	writeMockBinaries(mockBin);
	seedRepoLayout(root, { includeV220: true, includeV230: false });
	fs.unlinkSync(path.join(root, "docs/release/manifest-v2.2.0.md"));
	try {
		const result = runGateExpectFail(root, mockEnv(root, mockBin, { RELEASE_GATE_VERSION: "2.2.0" }));
		assert.equal(result.status, 1);
		assert.match(result.stderr, /missing v2\.2\.0 release manifest/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("fails when handoff PRD is missing for v2.1.0 gate", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "release-proof-gate-handoff-"));
	const mockBin = path.join(root, "bin");
	writeMockBinaries(mockBin);
	seedRepoLayout(root, { includeV210: true, includeV220: false, includeV230: false });
	fs.unlinkSync(path.join(root, "docs/PRD-v2.1.0-backlog-drain-handoff.md"));
	try {
		const result = runGateExpectFail(root, mockEnv(root, mockBin, { RELEASE_GATE_VERSION: "2.1.0" }));
		assert.equal(result.status, 1);
		assert.match(result.stderr, /missing handoff PRD/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("fails when handoff PRD is missing for v2.3.0 gate", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "release-proof-gate-handoff-v230-"));
	const mockBin = path.join(root, "bin");
	writeMockBinaries(mockBin);
	seedRepoLayout(root);
	fs.unlinkSync(path.join(root, "docs/PRD-v2.3.0-module-split-handoff.md"));
	try {
		const result = runGateExpectFail(root, mockEnv(root, mockBin));
		assert.equal(result.status, 1);
		assert.match(result.stderr, /missing handoff PRD/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("fails when handoff PRD is missing for v2.2.0 gate", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "release-proof-gate-handoff-v220-"));
	const mockBin = path.join(root, "bin");
	writeMockBinaries(mockBin);
	seedRepoLayout(root, { includeV220: true, includeV230: false });
	fs.unlinkSync(path.join(root, "docs/PRD-v2.2.0-backlog-drain-handoff.md"));
	try {
		const result = runGateExpectFail(root, mockEnv(root, mockBin, { RELEASE_GATE_VERSION: "2.2.0" }));
		assert.equal(result.status, 1);
		assert.match(result.stderr, /missing handoff PRD/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("RELEASE_GATE_VERSION=2.0.0 preserves proof manifest check only", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "release-proof-gate-v200-"));
	const mockBin = path.join(root, "bin");
	writeMockBinaries(mockBin);
	seedRepoLayout(root, { includeV210: false, includeV220: false, includeV230: false, includeProof: true });
	try {
		const stdout = runGate(root, mockEnv(root, mockBin, { RELEASE_GATE_VERSION: "2.0.0" }));
		assert.match(stdout, /proof manifest\s+PASS/);
		assert.match(stdout, /handoff PRD\s+SKIP/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("RELEASE_GATE_VERSION=both requires proof and v2.1.0 manifests", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "release-proof-gate-both-"));
	const mockBin = path.join(root, "bin");
	writeMockBinaries(mockBin);
	seedRepoLayout(root, { includeV210: true, includeV220: false, includeV230: false, includeProof: true });
	try {
		const stdout = runGate(root, mockEnv(root, mockBin, { RELEASE_GATE_VERSION: "both" }));
		assert.match(stdout, /proof manifest\s+PASS/);
		assert.match(stdout, /v2\.1\.0 release manifest\s+PASS/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("RELEASE_MANIFEST env overrides default manifest path", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "release-proof-gate-custom-"));
	const mockBin = path.join(root, "bin");
	writeMockBinaries(mockBin);
	seedRepoLayout(root, { includeV220: false, includeV230: false });
	writeFileSync(path.join(root, "docs/PRD-v2.3.0-module-split-handoff.md"), "# handoff\n", "utf-8");
	const customManifest = path.join(root, "docs/release/custom-manifest.md");
	writeFileSync(customManifest, "# custom\n", "utf-8");
	try {
		const stdout = runGate(
			root,
			mockEnv(root, mockBin, { RELEASE_MANIFEST: customManifest }),
		);
		assert.match(stdout, /release manifest \(RELEASE_MANIFEST\)\s+PASS/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
