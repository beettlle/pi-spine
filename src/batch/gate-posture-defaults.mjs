// @ts-check
/**
 * Gate category postures and documented defaults (SP-627 / FR-REL250-05 / #123).
 * Pure data only — no I/O and no auto-approve wiring.
 */

/** @typedef {"read" | "write" | "execute" | "destroy" | "network" | "auth"} GateCategory */
/** @typedef {"permissive" | "cautious" | "guarded" | "locked"} GatePosture */

/**
 * Categories for human-gate classification.
 * @type {ReadonlyArray<GateCategory>}
 */
export const GATE_CATEGORIES = Object.freeze([
	"read",
	"write",
	"execute",
	"destroy",
	"network",
	"auth",
]);

/**
 * Named approval postures (least → most restrictive).
 * @type {Readonly<{ PERMISSIVE: "permissive"; CAUTIOUS: "cautious"; GUARDED: "guarded"; LOCKED: "locked" }>}
 */
export const POSTURES = Object.freeze({
	PERMISSIVE: "permissive",
	CAUTIOUS: "cautious",
	GUARDED: "guarded",
	LOCKED: "locked",
});

/**
 * Categories that must remain locked (never auto-approve).
 * @type {ReadonlyArray<GateCategory>}
 */
export const LOCKED_CATEGORIES = Object.freeze(
	/** @type {GateCategory[]} */ (["destroy", "auth"]),
);

/**
 * @typedef {{
 *   posture: GatePosture;
 *   autoApproveAfterN: number | null;
 * }} CategoryPostureDefault
 *
 * `autoApproveAfterN` is null when posture is locked (always manual).
 * Zero means immediate auto-approve once posture allows it.
 */

/**
 * Documented default postures from GitHub #123.
 * destroy/auth stay locked; others are documented defaults for later config overlay.
 * @type {Readonly<Record<GateCategory, Readonly<CategoryPostureDefault>>>}
 */
export const DEFAULT_POSTURES = Object.freeze({
	read: Object.freeze({ posture: POSTURES.PERMISSIVE, autoApproveAfterN: 0 }),
	write: Object.freeze({ posture: POSTURES.CAUTIOUS, autoApproveAfterN: 3 }),
	execute: Object.freeze({ posture: POSTURES.GUARDED, autoApproveAfterN: 5 }),
	destroy: Object.freeze({ posture: POSTURES.LOCKED, autoApproveAfterN: null }),
	network: Object.freeze({ posture: POSTURES.CAUTIOUS, autoApproveAfterN: 3 }),
	auth: Object.freeze({ posture: POSTURES.LOCKED, autoApproveAfterN: null }),
});
