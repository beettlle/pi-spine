import fs from "node:fs";
import {
	journalPath,
	readJournalEvents,
	summarizeJournalEvent,
} from "../src/batch/journal.mjs";

/**
 * @param {string} timestamp
 */
function formatReplayTime(timestamp) {
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return String(timestamp);
	return date.toISOString().replace("T", " ").slice(0, 19);
}

/**
 * @param {object[]} events
 */
export function formatJournalReplayTable(events) {
	const lines = ["", "Journal replay", ""];
	lines.push("  time                | type                  | lane   | task     | summary");
	lines.push("  --------------------+-----------------------+--------+----------+------------------");

	for (const event of events) {
		const time = formatReplayTime(event.timestamp).padEnd(19);
		const type = String(event.type ?? "").padEnd(21);
		const lane = String(event.laneId ?? "—").padEnd(6);
		const task = String(event.taskId ?? "—").padEnd(8);
		const summary = summarizeJournalEvent(event);
		lines.push(`  ${time} | ${type} | ${lane} | ${task} | ${summary}`);
	}

	lines.push("");
	return lines.join("\n");
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} options.args
 */
export function runSpineJournal(options) {
	const { projectRoot, args } = options;
	const subcommand = args[0];

	if (subcommand !== "replay") {
		return {
			exitCode: 1,
			output: "Usage: spine journal replay --batch {id} [--json]\n",
		};
	}

	const batchIdx = args.indexOf("--batch");
	const batchId = batchIdx >= 0 ? args[batchIdx + 1] : null;
	const json = args.includes("--json");

	if (!batchId) {
		return {
			exitCode: 1,
			output: "Missing required --batch {id}\nUsage: spine journal replay --batch {id} [--json]\n",
		};
	}

	const filePath = journalPath(projectRoot, batchId);
	if (!fs.existsSync(filePath)) {
		return {
			exitCode: 1,
			output: `Journal not found for batch ${batchId}: ${filePath}\n`,
		};
	}

	const events = readJournalEvents(projectRoot, batchId);
	if (json) {
		return {
			exitCode: 0,
			output: `${JSON.stringify({ batchId, events }, null, 2)}\n`,
		};
	}

	return {
		exitCode: 0,
		output: formatJournalReplayTable(events),
	};
}
