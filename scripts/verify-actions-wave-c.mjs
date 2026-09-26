#!/usr/bin/env node
/**
 * Contract helper for SP-768 (#285 Wave C): fail if CI/release/real-pi still
 * pin Actions v4 or github-script v7, or lack checkout@v7 / github-script@v9.
 */
import fs from "node:fs";

const files = [
	".github/workflows/ci.yml",
	".github/workflows/release.yml",
	".github/workflows/real-pi.yml",
];

for (const f of files) {
	const t = fs.readFileSync(f, "utf8");
	if (t.includes("checkout@v4")) {
		console.error(`${f}: still has actions/checkout@v4`);
		process.exit(1);
	}
	if (t.includes("setup-node@v4")) {
		console.error(`${f}: still has actions/setup-node@v4`);
		process.exit(1);
	}
	if (t.includes("upload-artifact@v4")) {
		console.error(`${f}: still has actions/upload-artifact@v4`);
		process.exit(1);
	}
	if (t.includes("github-script@v7")) {
		console.error(`${f}: still has actions/github-script@v7`);
		process.exit(1);
	}
}

const ci = fs.readFileSync(".github/workflows/ci.yml", "utf8");
const release = fs.readFileSync(".github/workflows/release.yml", "utf8");
if (!ci.includes("checkout@v7")) {
	console.error("ci.yml: missing actions/checkout@v7");
	process.exit(1);
}
if (!release.includes("github-script@v9")) {
	console.error("release.yml: missing actions/github-script@v9");
	process.exit(1);
}

console.log("Actions Wave C pins OK");
