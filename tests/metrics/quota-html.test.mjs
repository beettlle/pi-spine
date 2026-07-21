import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";

import {
	escapeHtml,
	htmlReportPathForJson,
	renderQuotaHtml,
	writeHtmlBesideJson,
} from "../../src/metrics/quota-html.mjs";

const baseSnapshot = () => ({
	generatedAt: "2026-07-21T12:00:00.000Z",
	snapshotSource: "estimate",
	pools: {
		zai: {
			poolId: "zai",
			source: "estimate",
			expectedModels: ["zai/glm-5.2"],
			observedModels: ["zai/glm-5.2"],
			usage: {
				taskCount: 2,
				durationMs: 2000,
				tokensIn: 15,
				tokensOut: 35,
				estimatedUsd: 0.003,
			},
			drift: { unexpectedModels: [], missingModels: [] },
		},
		google: {
			poolId: "google",
			source: "absent",
			expectedModels: ["google/gemini-3.1-pro-preview"],
			observedModels: [],
			usage: { taskCount: 0, durationMs: 0 },
			drift: { unexpectedModels: [], missingModels: ["google/gemini-3.1-pro-preview"] },
		},
		unknown: {
			poolId: "unknown",
			source: "estimate",
			expectedModels: [],
			observedModels: ["openai/gpt-4"],
			usage: {
				taskCount: 1,
				durationMs: 100,
				tokensIn: 10,
				tokensOut: 20,
			},
			drift: { unexpectedModels: ["openai/gpt-4"], missingModels: [] },
		},
	},
});

test("escapeHtml encodes HTML-sensitive characters", () => {
	assert.equal(escapeHtml("<script>alert('x')</script>"), "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
	assert.equal(escapeHtml('"quoted"'), "&quot;quoted&quot;");
	assert.equal(escapeHtml("a & b"), "a &amp; b");
	assert.equal(escapeHtml(undefined), "");
});

test("renderQuotaHtml returns a self-contained HTML document", () => {
	const html = renderQuotaHtml(baseSnapshot());
	assert.ok(html.startsWith("<!DOCTYPE html>"));
	assert.ok(html.includes("<html lang=\"en\">"));
	assert.ok(html.includes("<style>"));
	assert.ok(!html.includes("http://") && !html.includes("https://"), "must not reference external URLs/CDNs");
});

test("renderQuotaHtml includes masthead, source, and timestamp", () => {
	const html = renderQuotaHtml(baseSnapshot());
	assert.ok(html.includes("Quota Headroom Report"));
	assert.ok(html.includes("<time datetime=\"2026-07-21T12:00:00.000Z\">2026-07-21T12:00:00.000Z</time>"));
	assert.ok(html.includes('class="badge source-estimate"'));
	assert.ok(html.includes("Source: <span class=\"badge source-estimate\">estimate</span>"));
	assert.ok(html.includes("Pools: 3"));
	assert.ok(html.includes("Live: 0"));
	assert.ok(html.includes("Estimate: 2"));
	assert.ok(html.includes("Absent: 1"));
});

test("renderQuotaHtml sorts unknown-headroom pools by observed burn descending", () => {
	const html = renderQuotaHtml(baseSnapshot());
	const bodyRows = [...html.matchAll(/class="pool-id">([^<]+)<\/td>/g)].map((m) => m[1]);
	assert.deepEqual(bodyRows, ["zai", "unknown", "google"]);
});

test("renderQuotaHtml shows remaining headroom as unknown when no limit is present", () => {
	const html = renderQuotaHtml(baseSnapshot());
	const rows = html.match(/Remaining Headroom[\s\S]*?<\/table>/)?.[0];
	assert.ok(rows, "expected Remaining Headroom table");
	assert.ok(rows.includes('class="unknown">unknown</td>'));
	assert.ok(!rows.includes("unlimited"));
});

test("renderQuotaHtml escapes all untrusted strings", () => {
	const snapshot = baseSnapshot();
	// Inject a malicious model name and pool id into the observed data.
	snapshot.pools.unknown.observedModels = ["<script>alert('x')</script>"];
	snapshot.pools.unknown.drift.unexpectedModels = ["<img src=x onerror=alert(1)>"];
	snapshot.pools["xss-pool"] = {
		poolId: "<script>alert('pool')</script>",
		source: "absent",
		expectedModels: [],
		observedModels: [],
		usage: { taskCount: 0, durationMs: 0 },
		drift: { unexpectedModels: [], missingModels: [] },
	};
	const html = renderQuotaHtml(snapshot);
	assert.ok(!html.includes("<script>alert('x')</script>"));
	assert.ok(!html.includes("<img src=x onerror=alert(1)>"));
	assert.ok(html.includes("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;"));
	assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
	assert.ok(html.includes("&lt;script&gt;alert(&#39;pool&#39;)&lt;/script&gt;"));
});

test("renderQuotaHtml renders attribution/drift and caveats", () => {
	const html = renderQuotaHtml(baseSnapshot());
	assert.ok(html.includes("Expected models (config)"));
	assert.ok(html.includes("Observed models"));
	assert.ok(html.includes("missing: google/gemini-3.1-pro-preview"));
	assert.ok(html.includes("unexpected: openai/gpt-4"));
	assert.ok(html.includes("Caveats &amp; Glossary"));
	assert.ok(html.includes("<summary>Caveats &amp; Glossary</summary>"));
});

test("renderQuotaHtml is honest when burn/ETA cannot be estimated", () => {
	const html = renderQuotaHtml(baseSnapshot());
	assert.ok(html.includes("Burn rate and ETA are not estimable"));
	assert.ok(html.includes("remaining headroom is unknown"));
});

test("htmlReportPathForJson derives the sibling HTML path", () => {
	assert.equal(
		htmlReportPathForJson("/tmp/.spine/reports/quota-2026-07-21T12-00-00Z.json"),
		"/tmp/.spine/reports/quota-2026-07-21T12-00-00Z.html",
	);
	assert.equal(htmlReportPathForJson("report.json"), "report.html");
});

test("writeHtmlBesideJson writes HTML next to the JSON file", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-html-"));
	const jsonPath = path.join(root, ".spine", "reports", "quota-2026-07-21T12-00-00Z.json");
	const html = renderQuotaHtml(baseSnapshot());
	try {
		const htmlPath = writeHtmlBesideJson(jsonPath, html);
		assert.equal(htmlPath, jsonPath.replace(/\.json$/, ".html"));
		assert.ok(fs.existsSync(htmlPath));
		assert.equal(fs.readFileSync(htmlPath, "utf8"), html);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
