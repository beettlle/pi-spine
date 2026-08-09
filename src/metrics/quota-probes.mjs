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
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DEFAULT_AUTH_PATH = path.join(os.homedir(), ".pi", "agent", "auth.json");

const PROBE_URLS = {
	zai: "https://api.z.ai/api/monitor/usage/quota/limit",
	"kimi-coding": "https://api.moonshot.ai/v1/users/me/balance",
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
 * @typedef {object} ProbeResult
 * @property {string} poolId
 * @property {"live" | "absent"} source
 * @property {PoolUsage} [usage]
 * @property {number} [limit]
 * @property {Error} [error]
 */

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
		const value = data[field];
		if (Number.isFinite(value) && value >= 0) return value;
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
	if (!data || typeof data !== "object") return undefined;
	for (const field of fields) {
		const value = data[field];
		if (Number.isFinite(value) && value >= 0) return value;
	}
	return undefined;
}

/**
 * Z.ai probe — uses the bearer key from `auth.json` to request the quota
 * monitor endpoint.
 *
 * Expected shape (used by mocked tests): `{ used: number, total: number }`.
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

		const result = { poolId: "zai", source: "live", usage };
		if (limit !== undefined) result.limit = limit;
		return result;
	} catch (error) {
		return { poolId: "zai", source: "absent", error };
	}
}

/**
 * Kimi (Moonshot) probe — uses the bearer key from `auth.json` to request the
 * balance endpoint.
 *
 * Expected shape (used by mocked tests): `{ used: number, total: number }`.
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

		/** @type {PoolUsage} */
		const usage = { taskCount: 0, durationMs: 0 };
		const used = extractNumber(data, ["used", "used_tokens"])
			?? extractNumber(data.data, ["used", "used_tokens"]);
		if (used !== undefined) usage.tokensOut = used;

		const balance =
			extractNumber(data, ["balance", "cash"]) ??
			extractNumber(data.data, ["balance", "cash"]);
		if (balance !== undefined) usage.estimatedUsd = balance;

		const limit =
			extractLimit(data, ["total", "total_tokens", "limit"]) ??
			extractLimit(data.data, ["total", "total_tokens", "limit"]);

		const result = { poolId: "kimi-coding", source: "live", usage };
		if (limit !== undefined) result.limit = limit;
		return result;
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
		}
	}

	return results;
}
