/**
 * Self-contained HTML evidence brief renderer for quota snapshots.
 *
 * Produces a secret-free, inline-styled HTML document from the privacy-safe
 * snapshot built by `src/metrics/quota-snapshot.mjs`. All user-facing strings
 * are escaped before insertion, so the report can be opened as a local file or
 * served without XSS risk.
 *
 * This module intentionally stays offline: it does not call live provider APIs
 * or read API keys. It is designed as the rendering backend for the
 * `spine metrics quota --open` flow (SP-679). The helper `writeHtmlBesideJson`
 * lets the CLI write a `.html` report next to the timestamped JSON snapshot.
 */

import fs from "node:fs";
import path from "node:path";

/**
 * Escape a value for safe insertion into HTML text and attribute contexts.
 *
 * @param {unknown} raw
 * @returns {string}
 */
export function escapeHtml(raw) {
	return String(raw ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/**
 * Format a number with thousands separators and no decimal junk.
 *
 * @param {number | undefined} value
 * @returns {string}
 */
function fmtCount(value) {
	if (!Number.isFinite(value)) return "—";
	return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

/**
 * Format a duration in milliseconds as human-readable seconds/milliseconds.
 *
 * @param {number | undefined} ms
 * @returns {string}
 */
function fmtDuration(ms) {
	if (!Number.isFinite(ms)) return "—";
	if (ms >= 1000) return `${fmtCount(ms / 1000)} s`;
	return `${fmtCount(ms)} ms`;
}

/**
 * Format a currency estimate in USD.
 *
 * @param {number | undefined} usd
 * @returns {string}
 */
function fmtCost(usd) {
	if (!Number.isFinite(usd)) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 6,
	}).format(usd);
}

/**
 * CSS class suffix for a source badge.
 *
 * @param {string} source
 * @returns {string}
 */
function sourceClass(source) {
	if (source === "live") return "live";
	if (source === "estimate") return "estimate";
	if (source === "absent") return "absent";
	return "unknown";
}

/**
 * Compute a numeric score for observed burn so pools can be ordered when no
 * provider quota limit is known. Prefer token volume, then cost, then duration.
 *
 * @param {import("./quota-snapshot.mjs").PoolSnapshot} pool
 * @returns {number}
 */
function burnScore(pool) {
	const usage = pool.usage || {};
	if (Number.isFinite(usage.tokensIn) || Number.isFinite(usage.tokensOut)) {
		return (usage.tokensIn || 0) + (usage.tokensOut || 0);
	}
	if (Number.isFinite(usage.estimatedUsd)) return usage.estimatedUsd;
	return usage.durationMs || 0;
}

/**
 * Compute remaining headroom when a pool carries a known limit. Most offline
 * snapshots do not include provider limits, so this returns `null` and the
 * report renders an honest "unknown".
 *
 * @param {import("./quota-snapshot.mjs").PoolSnapshot} pool
 * @returns {number | null}
 */
function remainingHeadroom(pool) {
	if (Number.isFinite(pool.limit) && pool.limit > 0) {
		// When a limit is present, choose the same usage unit as burnScore.
		const usage = pool.usage || {};
		let used = 0;
		if (Number.isFinite(usage.tokensIn) || Number.isFinite(usage.tokensOut)) {
			used = (usage.tokensIn || 0) + (usage.tokensOut || 0);
		} else if (Number.isFinite(usage.estimatedUsd)) {
			used = usage.estimatedUsd;
		} else {
			used = usage.durationMs || 0;
		}
		const remaining = pool.limit - used;
		return Number.isFinite(remaining) ? remaining : null;
	}
	return null;
}

/**
 * Sort pools by remaining headroom descending, with honest unknowns at the
 * bottom. Unknown pools are then ordered by observed burn descending so the
 * biggest consumers are surfaced first.
 *
 * @param {Record<string, import("./quota-snapshot.mjs").PoolSnapshot>} pools
 * @returns {import("./quota-snapshot.mjs").PoolSnapshot[]}
 */
function sortPoolsByHeadroom(pools) {
	return Object.values(pools).sort((a, b) => {
		const aHeadroom = remainingHeadroom(a);
		const bHeadroom = remainingHeadroom(b);
		if (aHeadroom !== null && bHeadroom !== null) return bHeadroom - aHeadroom;
		if (aHeadroom !== null) return -1;
		if (bHeadroom !== null) return 1;
		return burnScore(b) - burnScore(a);
	});
}

/**
 * Render a single row in the remaining-headroom table.
 *
 * @param {import("./quota-snapshot.mjs").PoolSnapshot} pool
 * @returns {string}
 */
function renderPoolRow(pool) {
	const usage = pool.usage || {};
	const headroom = remainingHeadroom(pool);
	const headroomCell =
		headroom !== null
			? `<td class="numeric">${escapeHtml(fmtCount(headroom))}</td>`
			: `<td class="unknown">unknown</td>`;

	const expectedModels = pool.expectedModels?.length
		? `<ul class="model-list">${pool.expectedModels
				.map((m) => `<li>${escapeHtml(m)}</li>`)
				.join("")}</ul>`
		: `<span class="muted">none expected</span>`;

	const observedModels = pool.observedModels?.length
		? `<ul class="model-list">${pool.observedModels
				.map((m) => `<li>${escapeHtml(m)}</li>`)
				.join("")}</ul>`
		: `<span class="muted">none observed</span>`;

	const drift = [];
	if (pool.drift?.missingModels?.length) {
		drift.push(`missing: ${pool.drift.missingModels.join(", ")}`);
	}
	if (pool.drift?.unexpectedModels?.length) {
		drift.push(`unexpected: ${pool.drift.unexpectedModels.join(", ")}`);
	}
	const driftCell = drift.length
		? `<td class="drift">${escapeHtml(drift.join("; "))}</td>`
		: `<td class="drift ok">in config</td>`;

	return `
    <tr>
      <td class="pool-id">${escapeHtml(pool.poolId)}</td>
      <td><span class="badge source-${sourceClass(pool.source)}">${escapeHtml(pool.source)}</span></td>
      <td>${expectedModels}</td>
      <td>${observedModels}</td>
      <td class="numeric">${escapeHtml(fmtCount(usage.taskCount))}</td>
      <td class="numeric">${escapeHtml(fmtDuration(usage.durationMs))}</td>
      <td class="numeric">${escapeHtml(fmtCount(usage.tokensIn))}</td>
      <td class="numeric">${escapeHtml(fmtCount(usage.tokensOut))}</td>
      <td class="numeric">${escapeHtml(fmtCost(usage.estimatedUsd))}</td>
      ${headroomCell}
      ${driftCell}
    </tr>
  `;
}

/**
 * Render a paragraph describing burn rate and ETA only when the data can
 * support it. Offline snapshots usually lack quota limits and a measurement
 * window, so this section is conservative and reports why it cannot estimate.
 *
 * @param {import("./quota-snapshot.mjs").PoolSnapshot[]} sortedPools
 * @returns {string}
 */
function renderBurnEta(sortedPools) {
	const poolsWithLimit = sortedPools.filter((p) => remainingHeadroom(p) !== null);
	if (!poolsWithLimit.length) {
		return `
      <p class="muted">
        Burn rate and ETA are not estimable from this snapshot. Provider quota
        limits are not configured, so remaining headroom is unknown. Use this
        report as a burn inventory, not a forecast.
      </p>
    `;
	}

	const rows = poolsWithLimit
		.map((pool) => {
			const headroom = /** @type {number} */ (remainingHeadroom(pool));
			const usage = pool.usage || {};
			const score = burnScore(pool);
			const eta = score > 0 && headroom > 0 ? "estimable" : "at or over limit";
			return `
        <tr>
          <td class="pool-id">${escapeHtml(pool.poolId)}</td>
          <td class="numeric">${escapeHtml(fmtCount(score))}</td>
          <td class="numeric">${escapeHtml(fmtCount(headroom))}</td>
          <td>${escapeHtml(eta)}</td>
        </tr>
      `;
		})
		.join("");

	return `
    <p>Headroom is known for the pools below, but ETA still requires a stable
    measurement window. Treat these as rough indicators.</p>
    <table class="data">
      <thead>
        <tr>
          <th>Pool</th>
          <th>Observed burn</th>
          <th>Remaining headroom</th>
          <th>ETA status</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Render a self-contained HTML evidence brief from a quota snapshot.
 *
 * @param {import("./quota-snapshot.mjs").QuotaSnapshot} snapshot
 * @returns {string}
 */
export function renderQuotaHtml(snapshot) {
	const generatedAt = snapshot?.generatedAt || new Date().toISOString();
	const source = snapshot?.snapshotSource || "absent";
	const pools = snapshot?.pools || {};
	const sortedPools = sortPoolsByHeadroom(pools);
	const poolCount = sortedPools.length;
	const estimateCount = sortedPools.filter((p) => p.source === "estimate").length;
	const absentCount = sortedPools.filter((p) => p.source === "absent").length;
	const liveCount = sortedPools.filter((p) => p.source === "live").length;

	const rows = sortedPools.map(renderPoolRow).join("");

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Quota Headroom Report</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #ffffff;
    --fg: #1a1a1a;
    --muted: #666666;
    --border: #d1d5db;
    --accent: #2563eb;
    --badge-live: #16a34a;
    --badge-estimate: #ca8a04;
    --badge-absent: #6b7280;
    --badge-unknown: #9ca3af;
    --drift: #b91c1c;
    --ok: #15803d;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0b0f19;
      --fg: #e5e7eb;
      --muted: #9ca3af;
      --border: #374151;
      --accent: #60a5fa;
      --badge-live: #22c55e;
      --badge-estimate: #facc15;
      --badge-absent: #9ca3af;
      --badge-unknown: #6b7280;
      --drift: #f87171;
      --ok: #4ade80;
    }
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5;
    margin: 0;
    padding: 1.5rem;
    background: var(--bg);
    color: var(--fg);
  }
  header.masthead {
    border-bottom: 1px solid var(--border);
    padding-bottom: 1rem;
    margin-bottom: 1.5rem;
  }
  h1 { margin: 0 0 0.25rem; font-size: 1.5rem; }
  .claim { color: var(--muted); margin: 0 0 1rem; }
  .meta { display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.9rem; color: var(--muted); }
  .badge {
    display: inline-block;
    padding: 0.1rem 0.4rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: #fff;
    background: var(--badge-unknown);
  }
  .badge.source-live { background: var(--badge-live); }
  .badge.source-estimate { background: var(--badge-estimate); }
  .badge.source-absent { background: var(--badge-absent); }
  section { margin-bottom: 2rem; }
  h2 { font-size: 1.15rem; margin: 0 0 0.75rem; }
  table.data {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  table.data th, table.data td {
    border: 1px solid var(--border);
    padding: 0.5rem 0.6rem;
    text-align: left;
    vertical-align: top;
  }
  table.data th { background: rgba(0,0,0,0.03); font-weight: 600; }
  @media (prefers-color-scheme: dark) { table.data th { background: rgba(255,255,255,0.05); } }
  .numeric { text-align: right; font-variant-numeric: tabular-nums; }
  .pool-id { font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .model-list { list-style: none; margin: 0; padding: 0; }
  .model-list li { padding: 0.05rem 0; }
  .muted { color: var(--muted); }
  .drift { color: var(--drift); }
  .drift.ok { color: var(--ok); }
  .unknown { color: var(--muted); font-style: italic; }
  details {
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    padding: 0.75rem 1rem;
  }
  summary { cursor: pointer; font-weight: 600; }
  details dl { margin: 0.75rem 0 0; }
  details dt { font-weight: 600; }
  details dd { margin: 0 0 0.5rem 1rem; color: var(--muted); }
</style>
</head>
<body>
<header class="masthead">
  <h1>Quota Headroom Report</h1>
  <p class="claim">Evidence brief built from an offline quota snapshot. No API keys or prompt bodies are included.</p>
  <div class="meta">
    <span>Snapshot: <time datetime="${escapeHtml(generatedAt)}">${escapeHtml(generatedAt)}</time></span>
    <span>Source: <span class="badge source-${sourceClass(source)}">${escapeHtml(source)}</span></span>
    <span>Pools: ${escapeHtml(poolCount)}</span>
    <span>Live: ${escapeHtml(liveCount)}</span>
    <span>Estimate: ${escapeHtml(estimateCount)}</span>
    <span>Absent: ${escapeHtml(absentCount)}</span>
  </div>
</header>
<main>
  <section>
    <h2>Remaining Headroom</h2>
    <table class="data">
      <thead>
        <tr>
          <th>Pool</th>
          <th>Source</th>
          <th>Expected models (config)</th>
          <th>Observed models</th>
          <th>Tasks</th>
          <th>Duration</th>
          <th>Tokens in</th>
          <th>Tokens out</th>
          <th>Est. cost</th>
          <th>Remaining headroom</th>
          <th>Drift</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </section>
  <section>
    <h2>Burn / ETA</h2>
    ${renderBurnEta(sortedPools)}
  </section>
  <details>
    <summary>Caveats &amp; Glossary</summary>
    <dl>
      <dt>Source</dt>
      <dd>Where the usage numbers came from. <strong>estimate</strong> means observed task metrics; <strong>absent</strong> means no tasks were recorded for that pool; <strong>live</strong> is reserved for future provider-probe enrichment.</dd>
      <dt>Expected models</dt>
      <dd>Models configured for active agent roles in <code>spine-config.json</code>.</dd>
      <dt>Observed models</dt>
      <dd>Models that actually appeared in <code>.spine/run-metrics.jsonl</code> task records.</dd>
      <dt>Remaining headroom</dt>
      <dd>Provider quota minus observed usage. Offline snapshots do not include provider limits, so this is reported as <em>unknown</em> rather than invented.</dd>
      <dt>Drift</dt>
      <dd>Models observed that were not expected, or expected models that were not observed.</dd>
      <dt>Privacy</dt>
      <dd>This report contains no API keys, prompt bodies, or auth file contents.</dd>
    </dl>
  </details>
</main>
</body>
</html>`;

	return html;
}

/**
 * Derive the HTML report path that corresponds to a JSON snapshot report.
 *
 * @param {string} jsonPath
 * @returns {string}
 */
export function htmlReportPathForJson(jsonPath) {
	const { dir, name } = path.parse(jsonPath);
	return path.join(dir, `${name}.html`);
}

/**
 * Write an HTML report next to a JSON snapshot file.
 *
 * This is the integration point for SP-679 (`spine metrics quota --open`). The
 * CLI can render the snapshot, write the JSON, then call this helper to create
 * a self-contained HTML file in the same directory.
 *
 * @param {string} jsonPath
 * @param {string} html
 * @param {object} [deps]
 * @param {typeof import("node:fs")} [deps.fs]
 */
export function writeHtmlBesideJson(jsonPath, html, { fs: fsDep = fs } = {}) {
	const htmlPath = htmlReportPathForJson(jsonPath);
	fsDep.mkdirSync(path.dirname(htmlPath), { recursive: true });
	fsDep.writeFileSync(htmlPath, html, "utf8");
	return htmlPath;
}
