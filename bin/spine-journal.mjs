import fs from "node:fs";
import path from "node:path";
import {
	exportJournalJsonl,
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

const JOURNAL_USAGE =
	"Usage:\n" +
	"  spine journal replay --batch {id} [--json]\n" +
	"  spine journal export --batch {id} --format jsonl [--output path]\n";

/**
 * @param {string} projectRoot
 * @param {string[]} args
 */
function runJournalReplay(projectRoot, args) {
	const batchIdx = args.indexOf("--batch");
	const batchId = batchIdx >= 0 ? args[batchIdx + 1] : null;
	const json = args.includes("--json");

	if (!batchId) {
		return {
			exitCode: 1,
			output: `Missing required --batch {id}\n${JOURNAL_USAGE}`,
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

/**
 * @param {string} projectRoot
 * @param {string[]} args
 */
function runJournalExport(projectRoot, args) {
	const exportUsage = "Usage: spine journal export --batch {id} --format jsonl [--output path]\n";
	const batchIdx = args.indexOf("--batch");
	const batchId = batchIdx >= 0 ? args[batchIdx + 1] : null;
	const formatIdx = args.indexOf("--format");
	const format = formatIdx >= 0 ? args[formatIdx + 1] : null;
	const outputIdx = args.indexOf("--output");
	const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : null;

	if (!batchId) {
		return {
			exitCode: 1,
			output: `Missing required --batch {id}\n${exportUsage}`,
		};
	}

	if (format !== "jsonl") {
		return {
			exitCode: 1,
			output: `Missing or unsupported --format (expected jsonl)\n${exportUsage}`,
		};
	}

	const content = exportJournalJsonl(projectRoot, batchId);
	if (content === null) {
		const filePath = journalPath(projectRoot, batchId);
		return {
			exitCode: 1,
			output: `Journal not found for batch ${batchId}: ${filePath}\n`,
		};
	}

	if (outputPath) {
		const dir = path.dirname(outputPath);
		if (dir !== ".") {
			fs.mkdirSync(dir, { recursive: true });
		}
		fs.writeFileSync(outputPath, content, "utf-8");
		return { exitCode: 0, output: "" };
	}

	return { exitCode: 0, output: content };
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} options.args
 */
export function runSpineJournal(options) {
	const { projectRoot, args } = options;
	const subcommand = args[0];
	const subArgs = args.slice(1);

	if (subcommand === "replay") {
		return runJournalReplay(projectRoot, subArgs);
	}

	if (subcommand === "export") {
		return runJournalExport(projectRoot, subArgs);
	}

	return {
		exitCode: 1,
		output: JOURNAL_USAGE,
	};
}
