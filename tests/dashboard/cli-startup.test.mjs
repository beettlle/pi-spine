import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
	formatDashboardStartupMessage,
	resolveDashboardPortWithSource,
	runSpineDashboard,
} from "../../bin/spine-dashboard.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("formatDashboardStartupMessage includes URL, port, and operator hints", () => {
	const message = formatDashboardStartupMessage({
		url: "http://127.0.0.1:8109",
		host: "127.0.0.1",
		port: 8109,
		portSource: "default",
	});

	assert.match(message, /Open in browser: http:\/\/127\.0\.0\.1:8109\//);
	assert.match(message, /Listen:\s+127\.0\.0\.1:8109 \(default\)/);
	assert.match(message, /→ Open http:\/\/127\.0\.0\.1:8109\//);
	assert.match(message, /spine status/);
	assert.match(message, /spine batch start/);
	assert.match(message, /\/api\/snapshot/);
	assert.match(message, /\/api\/events/);
	assert.match(message, /SSE \(~2s\)/i);
	assert.match(message, /Ctrl\+C/);
});

test("formatDashboardStartupMessage notes --port source", () => {
	const message = formatDashboardStartupMessage({
		url: "http://127.0.0.1:8110",
		host: "127.0.0.1",
		port: 8110,
		portSource: "cli",
	});

	assert.match(message, /--port\)/);
});

test("resolveDashboardPortWithSource prefers CLI over config", async () => {
	const projectRoot = await initGitRepo("spine-dash-port-");
	try {
		const configPath = path.join(projectRoot, ".spine", "spine-config.json");
		const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		config.dashboard = { port: 8200 };
		fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");

		const fromCli = resolveDashboardPortWithSource(projectRoot, 8110);
		assert.equal(fromCli.port, 8110);
		assert.equal(fromCli.portSource, "cli");

		const fromConfig = resolveDashboardPortWithSource(projectRoot, undefined);
		assert.equal(fromConfig.port, 8200);
		assert.equal(fromConfig.portSource, "config");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineDashboard writes startup to stdout before shutdown", async () => {
	const projectRoot = await initGitRepo("spine-dash-cli-startup-");
	const writes = [];
	const originalWrite = process.stdout.write.bind(process.stdout);

	process.stdout.write = (chunk, encoding, callback) => {
		writes.push(String(chunk));
		return originalWrite(chunk, encoding, callback);
	};

	try {
		const runPromise = runSpineDashboard({ projectRoot, args: ["--port", "0"] });
		await new Promise((resolve) => setTimeout(resolve, 200));

		const startupOutput = writes.join("");
		assert.match(startupOutput, /Open in browser:/);
		assert.match(startupOutput, /pi-spine dashboard/);

		process.emit("SIGINT");
		const result = await runPromise;

		assert.match(result.output ?? "", /Dashboard stopped/);
		assert.ok(writes.length >= 1, "startup banner should be written before return");
	} finally {
		process.stdout.write = originalWrite;
		await destroyGitRepo(projectRoot);
	}
});

test("spine dashboard CLI prints URL before process exits", async () => {
	const projectRoot = await initGitRepo("spine-dash-cli-spawn-");

	const child = spawn(
		process.execPath,
		[path.join(PACKAGE_ROOT, "bin/spine.mjs"), "dashboard", "--port", "0"],
		{ cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"] },
	);

	let stdout = "";
	child.stdout.on("data", (chunk) => {
		stdout += chunk;
	});

	try {
		await new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				if (stdout.includes("Open in browser:")) {
					resolve();
					return;
				}
				reject(new Error("startup banner not emitted before timeout"));
			}, 3000);

			child.on("error", (err) => {
				clearTimeout(timer);
				reject(err);
			});
			child.on("exit", (code) => {
				clearTimeout(timer);
				if (stdout.includes("Open in browser:")) {
					resolve();
					return;
				}
				reject(new Error(`child exited ${code} without startup banner`));
			});
		});

		assert.match(stdout, /Open in browser:/);
	} finally {
		child.kill("SIGTERM");
		await new Promise((resolve) => {
			child.on("close", resolve);
			setTimeout(resolve, 1000);
		});
		await destroyGitRepo(projectRoot);
	}
});
