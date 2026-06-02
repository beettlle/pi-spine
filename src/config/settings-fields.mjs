/**
 * FR-CFG-03 editable spine-config field registry (TP-032).
 * Pure validation — no filesystem writes.
 *
 * FR-CFG-04 (TP-046): `paths.tasksRoot` and `lanes.maxParallel` may be overridden at
 * runtime by `SPINE_TASKS_ROOT` and `SPINE_MAX_LANES` (precedence: env > file).
 * Only `lanes.maxParallel` is editable via `spine settings set`; tasks root is env/file only.
 */

/** @typedef {"boolean" | "number" | "string" | "enum"} SettingFieldType */

/**
 * @typedef {object} SettingField
 * @property {string} path Dotted path into spine-config.json
 * @property {string} label Human-readable label
 * @property {SettingFieldType} type
 * @property {number} [min]
 * @property {number} [max]
 * @property {string[]} [enum]
 * @property {boolean} [caseSensitive] When true, enum values match exactly (no lowercasing)
 * @property {boolean} [optional] When true, empty string is allowed for string fields
 */

/** @type {readonly SettingField[]} */
export const SETTINGS_FIELDS = Object.freeze([
	{
		path: "lanes.maxParallel",
		label: "Max parallel lanes",
		type: "number",
		min: 1,
		max: 32,
	},
	{
		path: "lanes.workerBackend",
		label: "Worker execution backend",
		type: "enum",
		enum: ["subprocess", "agentSession"],
		caseSensitive: true,
	},
	{
		path: "gates.requireBeforeIntegrate",
		label: "Require gate before integrate",
		type: "boolean",
	},
	{
		path: "agents.worker.model",
		label: "Worker model",
		type: "string",
		optional: true,
	},
	{
		path: "agents.worker.thinking",
		label: "Worker thinking level",
		type: "enum",
		enum: ["off", "low", "medium", "high"],
	},
	{
		path: "dashboard.port",
		label: "Dashboard port",
		type: "number",
		min: 1024,
		max: 65535,
	},
]);

const FIELD_BY_PATH = new Map(SETTINGS_FIELDS.map((field) => [field.path, field]));

/**
 * @returns {SettingField[]}
 */
export function listEditableFields() {
	return SETTINGS_FIELDS.map((field) => ({ ...field }));
}

/**
 * @param {unknown} path
 * @returns {{ ok: true, path: string, field: SettingField } | { ok: false, error: string }}
 */
export function parseSettingPath(path) {
	if (typeof path !== "string") {
		return { ok: false, error: "Setting path must be a string" };
	}

	const trimmed = path.trim();
	if (trimmed === "") {
		return { ok: false, error: "Setting path must be non-empty" };
	}

	const field = FIELD_BY_PATH.get(trimmed);
	if (!field) {
		return { ok: false, error: `Unknown setting path: ${trimmed}` };
	}

	return { ok: true, path: trimmed, field };
}

/**
 * @param {unknown} path
 * @param {unknown} rawValue
 * @returns {{ ok: true, normalizedValue: boolean | number | string } | { ok: false, error: string }}
 */
export function validateSettingValue(path, rawValue) {
	const parsed = parseSettingPath(path);
	if (!parsed.ok) {
		return parsed;
	}

	return validateForField(parsed.field, rawValue);
}

/**
 * @param {SettingField} field
 * @param {unknown} rawValue
 */
function validateForField(field, rawValue) {
	switch (field.type) {
		case "boolean":
			return validateBoolean(rawValue);
		case "number":
			return validateNumber(rawValue, field);
		case "string":
			return validateString(rawValue, field);
		case "enum":
			return validateEnum(rawValue, field);
		default:
			return { ok: false, error: `Unsupported field type: ${field.type}` };
	}
}

/**
 * @param {unknown} rawValue
 */
function validateBoolean(rawValue) {
	const coerced = coerceBoolean(rawValue);
	if (coerced === undefined) {
		return {
			ok: false,
			error: "Expected a boolean (true/false, 1/0, yes/no)",
		};
	}
	return { ok: true, normalizedValue: coerced };
}

/**
 * @param {unknown} rawValue
 * @param {SettingField} field
 */
function validateNumber(rawValue, field) {
	const coerced = coerceNumber(rawValue);
	if (coerced === undefined) {
		return { ok: false, error: "Expected a number" };
	}
	if (!Number.isInteger(coerced)) {
		return { ok: false, error: "Expected an integer" };
	}
	if (field.min != null && coerced < field.min) {
		return { ok: false, error: `Value must be >= ${field.min}` };
	}
	if (field.max != null && coerced > field.max) {
		return { ok: false, error: `Value must be <= ${field.max}` };
	}
	return { ok: true, normalizedValue: coerced };
}

/**
 * @param {unknown} rawValue
 * @param {SettingField} field
 */
function validateString(rawValue, field) {
	if (rawValue == null) {
		if (field.optional) {
			return { ok: true, normalizedValue: "" };
		}
		return { ok: false, error: "Expected a non-empty string" };
	}

	if (typeof rawValue !== "string" && typeof rawValue !== "number" && typeof rawValue !== "boolean") {
		return { ok: false, error: "Expected a string" };
	}

	const normalized = String(rawValue).trim();
	if (normalized === "" && !field.optional) {
		return { ok: false, error: "Expected a non-empty string" };
	}

	return { ok: true, normalizedValue: normalized };
}

/**
 * @param {unknown} rawValue
 * @param {SettingField} field
 */
function validateEnum(rawValue, field) {
	if (rawValue == null || (typeof rawValue === "string" && rawValue.trim() === "")) {
		return { ok: false, error: "Expected one of: " + (field.enum ?? []).join(", ") };
	}

	const normalized =
		typeof rawValue === "string" ? rawValue.trim() : String(rawValue).trim();
	const candidate = field.caseSensitive ? normalized : normalized.toLowerCase();
	const allowed = field.caseSensitive
		? (field.enum ?? [])
		: (field.enum ?? []).map((value) => value.toLowerCase());

	if (!allowed.includes(candidate)) {
		return {
			ok: false,
			error: `Expected one of: ${field.enum?.join(", ") ?? "(none)"}`,
		};
	}

	return { ok: true, normalizedValue: candidate };
}

/**
 * @param {unknown} rawValue
 * @returns {boolean | undefined}
 */
function coerceBoolean(rawValue) {
	if (typeof rawValue === "boolean") {
		return rawValue;
	}
	if (typeof rawValue === "number") {
		if (rawValue === 1) return true;
		if (rawValue === 0) return false;
		return undefined;
	}
	if (typeof rawValue !== "string") {
		return undefined;
	}

	const normalized = rawValue.trim().toLowerCase();
	if (["true", "1", "yes", "on"].includes(normalized)) return true;
	if (["false", "0", "no", "off"].includes(normalized)) return false;
	return undefined;
}

/**
 * @param {unknown} rawValue
 * @returns {number | undefined}
 */
function coerceNumber(rawValue) {
	if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
		return rawValue;
	}
	if (typeof rawValue !== "string") {
		return undefined;
	}

	const trimmed = rawValue.trim();
	if (trimmed === "") {
		return undefined;
	}

	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed)) {
		return undefined;
	}
	return parsed;
}
