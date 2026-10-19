// @ts-nocheck
/**
 * Optional provider quota probes.
 *
 * Reads API credentials from `~/.pi/agent/auth.json` and attempts to fetch live
 * usage from providers that expose a usage endpoint. All adapters are optional
 * and fail-closed: missing credentials, network errors, and non-ok responses
 * degrade to `source: "absent"` so the caller can fall back to the offline
 * estimate built from run metrics.
 *
 * No remaining percentage is ever invented. A numeric `limit` is only attached
 * to a probe result when the provider response explicitly includes one.
 *
 * Cursor is only probed when the auth file contains an explicit admin key
 * (`type: "admin_key"` or a dedicated `adminKey` field). Regular Cursor API
 * keys are not used and no undocumented dashboard HTML is scraped.
 *
 * Anthropic is only probed with an explicit Admin key (`type: "admin_key"`
 * or a dedicated `adminKey` field). Regular inference keys
 * (`sk-ant-api...`) are never sent to the Admin API. GitHub Copilot is only
 * probed when the auth entry carries a PAT plus an explicit org or enterprise
 * context; user-level entries without that scope degrade to `absent`.
 *
 * Google is permanently `absent` (SP-748): Google ships no public usage or
 * quota endpoint that authenticates with the AI Studio API key class pi
 * stores, and the AI Studio dashboards that show usage are HTML consoles
 * this project never scrapes. See `probeGoogle` for the research conclusion.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DEFAULT_AUTH_PATH = path.join(os.homedir(), ".pi", "agent", "auth.json");

const PROBE_URLS = {
	zai: "https://api.z.ai/api/monitor/usage/quota/limit",
	"kimi-coding": "https://api.kimi.com/coding/v1/usages",
	cursor: "https://api.cursor.com/teams/daily-usage-data",
	anthropic: "https://api.anthropic.com/v1/organizations/usage_report/messages",
};

const GITHUB_API_BASE = "https://api.github.com";

export const PROBE_POOLS = {
	zai: "zai",
	kimiCoding: "kimi-coding",
	cursor: "cursor",
	anthropic: "anthropic",
	githubCopilot: "github-copilot",
	google: "google",
};

/**
 * @typedef {object} PoolUsage
 * @property {number} taskCount
 * @property {number} durationMs
 * @property {number} [tokensIn]
 * @property {number} [tokensOut]
 * @property {number} [estimatedUsd]
 */

/**
 * One quota window reported by a provider (for example the 5-hour or weekly
 * window). `percentUsed` is 0-100 and is only set from provider-reported data.
 *
 * @typedef {object} QuotaWindow
 * @property {string} window Window id: `"5h"`, `"weekly"`, or `"monthly_tool_calls"`.
 * @property {number} percentUsed
 * @property {number} [used]
 * @property {number} [limit]
 * @property {string} [resetAt] ISO 8601 reset time.
 */

/**
 * `source` is `"live"` only when at least one window or usage value was
 * parsed. A successful HTTP response with no recognised quota fields is
 * `"unparsed"`; missing credentials, non-2xx responses, and network errors are
 * `"absent"`.
 *
 * @typedef {object} ProbeResult
 * @property {string} poolId
 * @property {"live" | "absent" | "unparsed"} source
 * @property {PoolUsage} [usage]
 * @property {number} [limit]
 * @property {QuotaWindow[]} [windows]
 * @property {Error | string} [error]
 */

const UNPARSED_ERROR = "HTTP 200 but no quota fields recognised";

/**
 * Read and parse the pi agent auth file, returning `null` when it is missing
 * or unreadable so callers fail closed.
 *
 * @param {string} [authPath]
 * @returns {object | null}
 */
export function loadAuthCredentials(authPath = DEFAULT_AUTH_PATH) {
	try {
		if (!fs.existsSync(authPath)) return null;
		const text = fs.readFileSync(authPath, "utf-8");
		const parsed = JSON.parse(text);
		if (!parsed || typeof parsed !== "object") return null;
		return parsed;
	} catch {
		return null;
	}
}

/**
 * Return the API key for a provider, or `undefined` when the credential is
 * missing or malformed.
 *
 * @param {object | null} auth
 * @param {string} poolId
 * @returns {string | undefined}
 */
function getProviderKey(auth, poolId) {
	const entry = auth?.[poolId];
	if (!entry || typeof entry !== "object") return undefined;
	if (typeof entry.key === "string" && entry.key.length > 0) return entry.key;
	return undefined;
}

/**
 * True when the auth file contains an explicit Cursor admin key.
 *
 * @param {object | null} auth
 * @returns {boolean}
 */
function hasCursorAdminKey(auth) {
	const entry = auth?.cursor;
	if (!entry || typeof entry !== "object") return false;
	if (entry.type === "admin_key" && typeof entry.key === "string" && entry.key.length > 0) {
		return true;
	}
	if (typeof entry.adminKey === "string" && entry.adminKey.length > 0) return true;
	return false;
}

/**
 * Return the explicit Anthropic Admin key from the auth file, or `undefined`
 * when only a regular inference key is present. The Admin API rejects
 * inference keys, so they are never used for the probe.
 *
 * @param {object | null} auth
 * @returns {string | undefined}
 */
function getAnthropicAdminKey(auth) {
	const entry = auth?.anthropic;
	if (!entry || typeof entry !== "object") return undefined;
	if (entry.type === "admin_key" && typeof entry.key === "string" && entry.key.length > 0) {
		return entry.key;
	}
	if (typeof entry.adminKey === "string" && entry.adminKey.length > 0) return entry.adminKey;
	return undefined;
}

/**
 * Return the GitHub Copilot billing probe context (PAT plus an explicit org
 * or enterprise scope), or `undefined` when either is missing. The billing
 * endpoints are only exposed at org/enterprise level, so user-level entries
 * without that context fail closed.
 *
 * @param {object | null} auth
 * @returns {{ key: string, url: string } | undefined}
 */
function getCopilotBillingContext(auth) {
	const entry = auth?.["github-copilot"];
	if (!entry || typeof entry !== "object") return undefined;
	const key = typeof entry.key === "string" && entry.key.length > 0 ? entry.key : undefined;
	if (!key) return undefined;
	if (typeof entry.org === "string" && entry.org.length > 0) {
		return { key, url: `${GITHUB_API_BASE}/orgs/${encodeURIComponent(entry.org)}/copilot/billing` };
	}
	if (typeof entry.enterprise === "string" && entry.enterprise.length > 0) {
		return { key, url: `${GITHUB_API_BASE}/enterprises/${encodeURIComponent(entry.enterprise)}/copilot/billing` };
	}
	return undefined;
}

/**
 * Make a JSON GET request with arbitrary headers, returning `null` on any
 * failure so adapters remain fail-closed.
 *
 * @param {string} url
 * @param {Record<string, string>} headers
 * @param {typeof globalThis.fetch} fetch
 * @returns {Promise<object | null>}
 */
async function fetchJsonWithHeaders(url, headers, fetch) {
	const response = await fetch(url, {
		method: "GET",
		headers: { Accept: "application/json", ...headers },
	});
	if (!response.ok) return null;
	const text = await response.text();
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

/**
 * Make a JSON GET request with a Bearer token, returning `null` on any failure
 * so adapters remain fail-closed.
 *
 * @param {string} url
 * @param {string} key
 * @param {typeof globalThis.fetch} fetch
 * @returns {Promise<object | null>}
 */
async function fetchJsonWithBearer(url, key, fetch) {
	return fetchJsonWithHeaders(url, { Authorization: `Bearer ${key}` }, fetch);
}

/**
 * Coerce a provider value to a finite non-negative number. Numeric strings
 * (`"63"`) are accepted because some providers serialise counters as strings.
 *
 * @param {unknown} value
 * @returns {number | undefined}
 */
function toNonNegativeNumber(value) {
	if (typeof value === "number") {
		return Number.isFinite(value) && value >= 0 ? value : undefined;
	}
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
	}
	return undefined;
}

/**
 * Extract a numeric limit from a provider response when it is explicitly
 * present; otherwise return `undefined` so the snapshot does not invent one.
 *
 * @param {object | null} data
 * @param {string[]} fields
 * @returns {number | undefined}
 */
function extractLimit(data, fields) {
	if (!data || typeof data !== "object") return undefined;
	for (const field of fields) {
		const value = toNonNegativeNumber(data[field]);
		if (value !== undefined) return value;
	}
	return undefined;
}

/**
 * Extract a numeric usage value from a provider response when it is explicitly
 * present; otherwise return `undefined`.
 *
 * @param {object | null} data
 * @param {string[]} fields
 * @returns {number | undefined}
 */
function extractNumber(data, fields) {
	return extractLimit(data, fields);
}

/**
 * Round a percentage to two decimals so float noise (62.74999999999999) does
 * not reach reports.
 *
 * @param {number} value
 * @returns {number}
 */
function roundPercent(value) {
	return Math.round(value * 100) / 100;
}

/**
 * Normalise a reset time (epoch milliseconds as number or numeric string, or
 * an ISO 8601 string) to an ISO string. Returns `undefined` when unparseable.
 *
 * @param {unknown} value
 * @returns {string | undefined}
 */
function toIsoTime(value) {
	if (value === undefined || value === null || value === "") return undefined;
	const epoch = toNonNegativeNumber(value);
	const date = new Date(epoch !== undefined ? epoch : /** @type {string} */ (value));
	if (Number.isNaN(date.getTime())) return undefined;
	return date.toISOString();
}

/**
 * Build a window entry, omitting fields the provider did not report.
 *
 * @param {string} window
 * @param {number | undefined} percentUsed
 * @param {{ used?: number, limit?: number, resetAt?: string }} [extra]
 * @returns {QuotaWindow | undefined}
 */
function makeWindow(window, percentUsed, extra = {}) {
	if (percentUsed === undefined) return undefined;
	/** @type {QuotaWindow} */
	const entry = { window, percentUsed: roundPercent(percentUsed) };
	if (extra.used !== undefined) entry.used = extra.used;
	if (extra.limit !== undefined) entry.limit = extra.limit;
	if (extra.resetAt !== undefined) entry.resetAt = extra.resetAt;
	return entry;
}

/**
 * Percentage from explicit `used` / `limit` counters; `undefined` when the
 * limit is missing or zero.
 *
 * @param {number | undefined} used
 * @param {number | undefined} limit
 * @returns {number | undefined}
 */
function percentFromCounts(used, limit) {
	if (used === undefined || limit === undefined || limit <= 0) return undefined;
	return (used / limit) * 100;
}

/**
 * Parse Z.ai `data.limits[]` into quota windows. `TOKENS_LIMIT` entries map by
 * `unit`/`number` (3/5 = 5-hour, 6/1 = weekly); `TIME_LIMIT` is the monthly
 * tool-call allowance. Unknown entries are skipped, never guessed.
 *
 * @param {unknown} limits
 * @returns {QuotaWindow[]}
 */
function parseZaiWindows(limits) {
	if (!Array.isArray(limits)) return [];
	/** @type {QuotaWindow[]} */
	const windows = [];
	const seen = new Set();
	for (const item of limits) {
		if (!item || typeof item !== "object") continue;
		let id;
		if (item.type === "TOKENS_LIMIT") {
			const unit = toNonNegativeNumber(item.unit);
			const number = toNonNegativeNumber(item.number);
			if (unit === 3 && number === 5) id = "5h";
			else if (unit === 6 && number === 1) id = "weekly";
		} else if (item.type === "TIME_LIMIT") {
			id = "monthly_tool_calls";
		}
		if (!id || seen.has(id)) continue;

		// For TIME_LIMIT, `usage` is the allowance and `currentValue` the count used.
		const limit = id === "monthly_tool_calls" ? toNonNegativeNumber(item.usage) : undefined;
		const used = id === "monthly_tool_calls" ? toNonNegativeNumber(item.currentValue) : undefined;
		const percent = toNonNegativeNumber(item.percentage) ?? percentFromCounts(used, limit);
		const entry = makeWindow(id, percent, { used, limit, resetAt: toIsoTime(item.nextResetTime) });
		if (!entry) continue;
		seen.add(id);
		windows.push(entry);
	}
	return windows;
}

/**
 * True when a Kimi `limits[]` window descriptor is the 5-hour window
 * (300 minutes or 5 hours).
 *
 * @param {object | undefined} win
 * @returns {boolean}
 */
function isKimiFiveHourWindow(win) {
	if (!win || typeof win !== "object") return false;
	const duration = toNonNegativeNumber(win.duration);
	if (duration === undefined) return false;
	if (win.timeUnit === "TIME_UNIT_MINUTE") return duration === 300;
	if (win.timeUnit === "TIME_UNIT_HOUR") return duration === 5;
	return false;
}

/**
 * Build a window from a Kimi `{ used, limit, resetTime }` counter block.
 *
 * @param {string} id
 * @param {object | undefined} block
 * @returns {QuotaWindow | undefined}
 */
function kimiCounterWindow(id, block) {
	if (!block || typeof block !== "object") return undefined;
	const used = toNonNegativeNumber(block.used);
	const limit = toNonNegativeNumber(block.limit);
	return makeWindow(id, percentFromCounts(used, limit), {
		used,
		limit,
		resetAt: toIsoTime(block.resetTime),
	});
}

/**
 * Parse the Kimi Coding `/coding/v1/usages` response. `usages.limit_5h` and
 * `usages.limit_7d` (`used_ratio`, `reset_time`) are preferred; `limits[]`
 * detail (5-hour) and top-level `usage` (weekly) are fallbacks.
 *
 * @param {object} data
 * @returns {QuotaWindow[]}
 */
function parseKimiWindows(data) {
	/** @type {QuotaWindow[]} */
	const windows = [];
	const usages = data.usages && typeof data.usages === "object" ? data.usages : {};

	const ratioWindow = (id, block) => {
		if (!block || typeof block !== "object") return undefined;
		const ratio = toNonNegativeNumber(block.used_ratio);
		return makeWindow(id, ratio === undefined ? undefined : ratio * 100, {
			resetAt: toIsoTime(block.reset_time),
		});
	};

	let fiveHour = ratioWindow("5h", usages.limit_5h);
	if (!fiveHour && Array.isArray(data.limits)) {
		for (const item of data.limits) {
			if (!item || typeof item !== "object" || !isKimiFiveHourWindow(item.window)) continue;
			fiveHour = kimiCounterWindow("5h", item.detail);
			if (fiveHour) break;
		}
	}
	if (fiveHour) windows.push(fiveHour);

	const weekly = ratioWindow("weekly", usages.limit_7d) ?? kimiCounterWindow("weekly", data.usage);
	if (weekly) windows.push(weekly);

	return windows;
}

/**
 * Z.ai probe — uses the bearer key from `auth.json` to request the quota
 * monitor endpoint.
 *
 * Real shape: `{ data: { limits: [{ type, unit, number, percentage,
 * nextResetTime }] } }` (see #351). Flat `{ used, total }` bodies are still
 * read when present. A 2xx response with nothing recognised is `"unparsed"`,
 * never `"live"`.
 *
 * @param {object | null} auth
 * @param {typeof globalThis.fetch} fetch
 * @returns {Promise<ProbeResult>}
 */
async function probeZai(auth, fetch) {
	const key = getProviderKey(auth, "zai");
	if (!key) return { poolId: "zai", source: "absent" };

	try {
		const data = await fetchJsonWithBearer(PROBE_URLS.zai, key, fetch);
		if (!data) return { poolId: "zai", source: "absent" };

		/** @type {PoolUsage} */
		const usage = { taskCount: 0, durationMs: 0 };
		const used = extractNumber(data, ["used", "used_tokens", "usage"])
			?? extractNumber(data.data, ["used", "used_tokens", "usage"]);
		if (used !== undefined) usage.tokensOut = used;

		const limit =
			extractLimit(data, ["total", "total_tokens", "limit"]) ??
			extractLimit(data.data, ["total", "total_tokens", "limit"]);

		const windows = parseZaiWindows(data.data?.limits);

		if (used === undefined && windows.length === 0) {
			return { poolId: "zai", source: "unparsed", error: UNPARSED_ERROR };
		}
		const result = { poolId: "zai", source: "live", usage };
		if (limit !== undefined) result.limit = limit;
		if (windows.length > 0) result.windows = windows;
		return result;
	} catch (error) {
		return { poolId: "zai", source: "absent", error };
	}
}

/**
 * Kimi Coding probe — uses the bearer key from `auth.json` to request the
 * `/coding/v1/usages` endpoint (the Moonshot platform balance endpoint rejects
 * Kimi Coding plan keys). Numbers arrive as strings. A 2xx response with
 * nothing recognised is `"unparsed"`, never `"live"`.
 *
 * @param {object | null} auth
 * @param {typeof globalThis.fetch} fetch
 * @returns {Promise<ProbeResult>}
 */
async function probeKimi(auth, fetch) {
	const key = getProviderKey(auth, "kimi-coding");
	if (!key) return { poolId: "kimi-coding", source: "absent" };

	try {
		const data = await fetchJsonWithBearer(PROBE_URLS["kimi-coding"], key, fetch);
		if (!data) return { poolId: "kimi-coding", source: "absent" };

		const windows = parseKimiWindows(data);
		if (windows.length === 0) {
			return { poolId: "kimi-coding", source: "unparsed", error: UNPARSED_ERROR };
		}
		/** @type {PoolUsage} */
		const usage = { taskCount: 0, durationMs: 0 };
		return { poolId: "kimi-coding", source: "live", usage, windows };
	} catch (error) {
		return { poolId: "kimi-coding", source: "absent", error };
	}
}

/**
 * Cursor probe — only runs when an explicit admin key is present in
 * `auth.json`. Regular Cursor keys are not used and no dashboard HTML is
 * scraped.
 *
 * Expected shape (used by mocked tests): `{ used_tokens: number }` or
 * `{ total_tokens: number }`.
 *
 * @param {object | null} auth
 * @param {typeof globalThis.fetch} fetch
 * @returns {Promise<ProbeResult>}
 */
async function probeCursor(auth, fetch) {
	if (!hasCursorAdminKey(auth)) {
		return { poolId: "cursor", source: "absent" };
	}
	const key = auth.cursor.type === "admin_key" ? auth.cursor.key : auth.cursor.adminKey;

	try {
		const data = await fetchJsonWithBearer(PROBE_URLS.cursor, key, fetch);
		if (!data) return { poolId: "cursor", source: "absent" };

		/** @type {PoolUsage} */
		const usage = { taskCount: 0, durationMs: 0 };
		const used = extractNumber(data, ["used_tokens", "total_tokens", "usage"])
			?? extractNumber(data.data, ["used_tokens", "total_tokens", "usage"]);
		if (used !== undefined) usage.tokensOut = used;

		const limit =
			extractLimit(data, ["total_tokens", "limit"]) ??
			extractLimit(data.data, ["total_tokens", "limit"]);

		const result = { poolId: "cursor", source: "live", usage };
		if (limit !== undefined) result.limit = limit;
		return result;
	} catch (error) {
		return { poolId: "cursor", source: "absent", error };
	}
}

/**
 * Anthropic probe — only runs when an explicit Admin key is present in
 * `auth.json`. Regular inference keys (`type: "api_key"`, `sk-ant-api...`)
 * are never sent to the Admin API.
 *
 * Expected shape (used by mocked tests): `{ used: number }` or a `data`
 * array whose entries carry `tokens` fields. A numeric limit is only
 * attached when the response explicitly includes one.
 *
 * @param {object | null} auth
 * @param {typeof globalThis.fetch} fetch
 * @returns {Promise<ProbeResult>}
 */
async function probeAnthropic(auth, fetch) {
	const key = getAnthropicAdminKey(auth);
	if (!key) return { poolId: "anthropic", source: "absent" };

	try {
		const data = await fetchJsonWithHeaders(
			PROBE_URLS.anthropic,
			{ "x-api-key": key, "anthropic-version": "2023-06-01" },
			fetch,
		);
		if (!data) return { poolId: "anthropic", source: "absent" };

		/** @type {PoolUsage} */
		const usage = { taskCount: 0, durationMs: 0 };
		const used = extractNumber(data, ["used", "used_tokens", "total_tokens"])
			?? extractNumber(data.data, ["used", "used_tokens", "total_tokens"]);
		if (used !== undefined) usage.tokensOut = used;

		const limit =
			extractLimit(data, ["total", "limit"]) ??
			extractLimit(data.data, ["total", "limit"]);

		const result = { poolId: "anthropic", source: "live", usage };
		if (limit !== undefined) result.limit = limit;
		return result;
	} catch (error) {
		return { poolId: "anthropic", source: "absent", error };
	}
}

/**
 * GitHub Copilot probe — only runs when the auth entry carries a PAT plus
 * an explicit org or enterprise context. User-level entries without that
 * scope fail closed because the billing endpoints are org/enterprise-only.
 *
 * Expected shape (used by mocked tests): `{ used: number }` or
 * `{ usage: { used: number } }`. Seat-only billing payloads still count as
 * live but contribute no usage numbers. A numeric limit is only attached
 * when the response explicitly includes one.
 *
 * @param {object | null} auth
 * @param {typeof globalThis.fetch} fetch
 * @returns {Promise<ProbeResult>}
 */
async function probeGitHubCopilot(auth, fetch) {
	const context = getCopilotBillingContext(auth);
	if (!context) return { poolId: "github-copilot", source: "absent" };

	try {
		const data = await fetchJsonWithHeaders(
			context.url,
			{
				Authorization: `Bearer ${context.key}`,
				"X-GitHub-Api-Version": "2022-11-28",
			},
			fetch,
		);
		if (!data) return { poolId: "github-copilot", source: "absent" };

		/** @type {PoolUsage} */
		const usage = { taskCount: 0, durationMs: 0 };
		// Seat counts are deliberately not mapped into taskCount: seats are not
		// tasks and conflating them would invent usage the API never reported.
		const used = extractNumber(data, ["used", "used_premium_requests", "total_used"])
			?? extractNumber(data.usage, ["used", "total"]);
		if (used !== undefined) usage.tokensOut = used;

		const limit = extractLimit(data, ["limit", "seat_limit"]);

		const result = { poolId: "github-copilot", source: "live", usage };
		if (limit !== undefined) result.limit = limit;
		return result;
	} catch (error) {
		return { poolId: "github-copilot", source: "absent", error };
	}
}

/**
 * Google probe — permanently `absent` (SP-748, closes #277 with a documented
 * won't-scrape rationale).
 *
 * Research conclusion (verified 2026-09-05): Google publishes no public usage
 * or quota endpoint that authenticates with the credential class pi stores in
 * `auth.json` (`{ "google": { "type": "api_key", "key": "AIza..." } }`, an
 * AI Studio standard API key):
 *
 * - The Generative Language API reference (ai.google.dev/api) documents only
 *   inference and platform endpoints (interactions, generateContent,
 *   batch, embeddings, files, caches, countTokens); there is no usage-report
 *   or quota resource.
 * - Rate limits and usage are published solely through AI Studio HTML
 *   dashboards (aistudio.google.com/rate-limit), which this project never
 *   scrapes.
 * - The programmatic alternatives (Cloud Monitoring `request_count` metrics,
 *   Service Usage `consumerQuotaMetrics`) require GCP OAuth credentials with
 *   cloud-platform scope — a different credential class — and expose quota
 *   limits, not current usage.
 *
 * The probe therefore fails closed without reading the credential or touching
 * the network, so the `google` pool keeps its offline estimate. When Google
 * ships a public usage/quota endpoint for this key class, implement it here
 * following the Z.ai/Kimi adapter pattern: explicit fields only, never invent
 * a limit or remaining percentage, and never include secrets in the result.
 *
 * @param {object | null} _auth
 * @param {typeof globalThis.fetch} _fetch
 * @returns {Promise<ProbeResult>}
 */
async function probeGoogle(_auth, _fetch) {
	return { poolId: "google", source: "absent" };
}

/**
 * Run the optional provider probes and return a map keyed by pool id.
 *
 * @param {object} [params]
 * @param {string} [params.authPath]
 * @param {typeof globalThis.fetch} [params.fetch]
 * @param {string[]} [params.providers]
 * @returns {Promise<Record<string, ProbeResult>>}
 */
export async function runQuotaProbes({
	authPath = DEFAULT_AUTH_PATH,
	fetch = globalThis.fetch,
	providers = [
		PROBE_POOLS.zai,
		PROBE_POOLS.kimiCoding,
		PROBE_POOLS.cursor,
		PROBE_POOLS.anthropic,
		PROBE_POOLS.githubCopilot,
		PROBE_POOLS.google,
	],
} = {}) {
	const auth = loadAuthCredentials(authPath);
	/** @type {Record<string, ProbeResult>} */
	const results = {};

	for (const provider of providers) {
		if (provider === PROBE_POOLS.zai) {
			results.zai = await probeZai(auth, fetch);
		} else if (provider === PROBE_POOLS.kimiCoding) {
			results["kimi-coding"] = await probeKimi(auth, fetch);
		} else if (provider === PROBE_POOLS.cursor) {
			results.cursor = await probeCursor(auth, fetch);
		} else if (provider === PROBE_POOLS.anthropic) {
			results.anthropic = await probeAnthropic(auth, fetch);
		} else if (provider === PROBE_POOLS.githubCopilot) {
			results["github-copilot"] = await probeGitHubCopilot(auth, fetch);
		} else if (provider === PROBE_POOLS.google) {
			results.google = await probeGoogle(auth, fetch);
		}
	}

	return results;
}
