#!/usr/bin/env node
/**
 * GitHub issue draft CLI (issue #60 Tier 1c).
 * Usage: spine issue draft [--type bug|enhancement|question] [--title TITLE] [--json] [--out PATH] [--create]
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { buildIssueDraftBody } from "../src/cli/issue-draft.mjs";
import { commandExists } from "../src/util/command-exists.mjs";
import { c, die, isCliEntrypoint } from "./spine-cli/shared.mjs";

const DEFAULT_OUT_PATH = ".spine/issue-draft.md";

/**
 * @param {string[]} argv
 */
export function parseIssueDraftArgs(argv) {
	/** @type {{ issueType: "bug"|"enhancement"|"question", title: string|null, json: boolean, outPath: string, create: boolean }} */
	const args = {
		issueType: "bug",
		title: null,
		json: false,
		outPath: DEFAULT_OUT_PATH,
		create: false,
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--type") {
			const value = argv[++i];
			if (value !== "bug" && value !== "enhancement" && value !== "question") {
				die(`Invalid --type value: ${value ?? "(missing)"}\nExpected bug, enhancement, or question.`);
			}
			args.issueType = value;
		} else if (arg === "--title") {
			args.title = argv[++i] ?? null;
		} else if (arg === "--json") {
			args.json = true;
		} else if (arg === "--out") {
			args.outPath = argv[++i] ?? DEFAULT_OUT_PATH;
		} else if (arg === "--create") {
			args.create = true;
		} else if (arg === "--help" || arg === "-h") {
			return { ...args, help: true };
		} else {
			die(`Unknown argument: ${arg}\nRun ${c.cyan}spine issue draft --help${c.reset} for usage.`);
		}
	}

	return args;
}

export function printIssueDraftHelp() {
	console.log(`
${c.bold}spine issue draft${c.reset} — build a GitHub issue draft from project state

${c.bold}Usage:${c.reset}
  spine issue draft [--type bug|enhancement|question] [--title TITLE] [--json] [--out PATH] [--create]

${c.bold}Options:${c.reset}
  --type TYPE     Issue type label: bug (default), enhancement, or question
  --title TITLE   Override issue title (default: diagnosis headline)
  --json          Print { title, body, labels, draftPath? } as JSON
  --out PATH      Write markdown body to PATH (default: ${DEFAULT_OUT_PATH})
  --create        Create GitHub issue via gh CLI (requires gh on PATH)
`);
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} [options.args]
 */
export function runSpineIssueDraft(options) {
	const { projectRoot, args: argv = [] } = options;
	const parsed = parseIssueDraftArgs(argv);
	if ("help" in parsed && parsed.help) {
		printIssueDraftHelp();
		return { exitCode: 0, output: "" };
	}

	let draft;
	try {
		draft = buildIssueDraftBody({
			projectRoot,
			issueType: parsed.issueType,
			title: parsed.title ?? undefined,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { exitCode: 1, output: `ERROR: ${message}\n` };
	}

	const draftPath = path.resolve(projectRoot, parsed.outPath);
	let wroteDraft = false;
	if (!parsed.json) {
		fs.mkdirSync(path.dirname(draftPath), { recursive: true });
		fs.writeFileSync(draftPath, draft.body, "utf-8");
		wroteDraft = true;
	}

	if (parsed.create) {
		if (!commandExists("gh")) {
			return {
				exitCode: 1,
				output:
					"ERROR: gh CLI not found on PATH. Install GitHub CLI or omit --create.\n",
			};
		}

		const bodyFilePath = wroteDraft ? draftPath : path.join(projectRoot, ".spine", ".issue-draft-body.tmp.md");
		if (!wroteDraft) {
			fs.mkdirSync(path.dirname(bodyFilePath), { recursive: true });
			fs.writeFileSync(bodyFilePath, draft.body, "utf-8");
		}

		const ghArgs = [
			"issue",
			"create",
			"--title",
			draft.title,
			"--body-file",
			bodyFilePath,
		];
		for (const label of draft.labels) {
			ghArgs.push("--label", label);
		}

		const ghResult = spawnSync("gh", ghArgs, {
			cwd: projectRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		});

		if (!wroteDraft && bodyFilePath.endsWith(".issue-draft-body.tmp.md")) {
			try {
				fs.unlinkSync(bodyFilePath);
			} catch {
				// Best-effort cleanup of temp body file.
			}
		}

		if (ghResult.status !== 0) {
			const stderr = (ghResult.stderr ?? "").trim();
			return {
				exitCode: ghResult.status ?? 1,
				output: stderr ? `ERROR: ${stderr}\n` : "ERROR: gh issue create failed\n",
			};
		}
	}

	if (parsed.json) {
		const payload = {
			title: draft.title,
			body: draft.body,
			labels: draft.labels,
		};
		if (wroteDraft) {
			payload.draftPath = path.relative(projectRoot, draftPath);
		}
		return { exitCode: 0, output: `${JSON.stringify(payload, null, 2)}\n` };
	}

	const humanOutput = [`# ${draft.title}`, "", draft.body, ""].join("\n");
	return { exitCode: 0, output: humanOutput };
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} [options.args]
 */
export function runSpineIssue(options) {
	const { projectRoot, args: argv = [] } = options;
	const sub = argv[0];
	if (sub !== "draft") {
		return {
			exitCode: 1,
			output:
				`Usage: spine issue draft [--type bug|enhancement|question] [--title TITLE] [--json] [--out PATH] [--create]\n`,
		};
	}
	return runSpineIssueDraft({ projectRoot, args: argv.slice(1) });
}

if (isCliEntrypoint(import.meta.url)) {
	const { exitCode, output } = runSpineIssue({
		projectRoot: process.cwd(),
		args: process.argv.slice(2),
	});
	process.stdout.write(output ?? "");
	process.exit(exitCode);
}
