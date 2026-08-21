/**
 * Shared error type for evidence command parse/exec failures.
 * Kept separate so path-prefix helpers can throw without a cycle on evidence-command.mjs.
 */

export class EvidenceCommandError extends Error {
	/**
	 * @param {string} message
	 */
	constructor(message) {
		super(message);
		this.name = "EvidenceCommandError";
	}
}
