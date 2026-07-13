// @ts-nocheck
/**
 * Gate-ready headline context — demote historical merge blockers (#195 / FR-REL231-01).
 */

/**
 * Gate-ready batches must not headline historical merge/gitignored blockers (#195 / FR-REL231-01).
 *
 * @param {string} diagnosis
 * @param {object} [ctx]
 * @param {boolean} [ctx.allTasksTerminalSuccess]
 * @param {boolean} [ctx.integrateGateOpen]
 * @returns {boolean}
 */
export function isGateReadyHeadlineContext(diagnosis, ctx = {}) {
	if (diagnosis === "needs_integrate") {
		return true;
	}
	if (ctx.allTasksTerminalSuccess === true && ctx.integrateGateOpen === true) {
		return true;
	}
	return false;
}
