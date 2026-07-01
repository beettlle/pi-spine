/**
 * GitHub issue draft body assembly (issue #60 Tier 1b).
 */

import fs from "node:fs";
import path from "node:path";

import { reconcileBatch } from "../batch/reconcile.mjs";
import { runDoctorChecks } from "../doctor/run-doctor-checks.mjs";
import { PACKAGE_ROOT } from "../config/spine-init-constants.mjs";
import {
	assembleHandoffData,
	redactHandoffSecrets,
	redactHandoffText,
} from "./handoff.mjs";

const VALID_ISSUE_TYPES = new Set(["bug", "enhancement", "question"]);

const ISSUE_TYPE_LABELS = {
	bug: "bug",
	enhancement: "enhancement",
	question: "question",
};

/**
 * @param {ReturnType<typeof runDoctorChecks>} doctorResult
 */
function formatDoctorSummary(doctorResult) {
	return doctorResult.checks
		.map((check) => {
			const status = check.warning ? "WARN" : check.ok ? "OK" : "FAIL";
			const detail = check.detail ? ` (${check.detail})` : "";
			return `- ${status} ${check.label}${detail}`;
		})
		.join("\n");
}

/**
 * @param {ReturnType<typeof reconcileBatch>} reconciliation
 */
function formatDiagnosisBlock(reconciliation) {
	const lines = [
		`- **Diagnosis:** ${reconciliation.diagnosis ?? "idle"}`,
		`- **Headline:** ${reconciliation.headline ?? "—"}`,
		`- **Suggested command:** ${reconciliation.suggestedCommand ?? "—"}`,
	];
	if (reconciliation.batchId) {
		lines.push(`- **Batch ID:** ${reconciliation.batchId}`);
	}
	if (reconciliation.phase) {
		lines.push(`- **Phase:** ${reconciliation.phase}`);
	}
	return lines.join("\n");
}

/**
 * @param {ReturnType<typeof assembleHandoffData>} handoff
 */
function formatJournalExcerpt(handoff) {
	if (!handoff.journalTail?.length) {
		return "- (none)";
	}
	return handoff.journalTail
		.map((entry) => {
			const suffix = entry.taskId
				? ` ${entry.taskId}`
				: entry.laneId
					? ` ${entry.laneId}`
					: "";
			return `- ${entry.timestamp} ${entry.type}${suffix}`;
		})
		.join("\n");
}

/**
 * @param {ReturnType<typeof reconcileBatch>} reconciliation
 */
function formatCommandsRun(reconciliation) {
	const lines = [`- ${reconciliation.suggestedCommand ?? "spine preflight"}`];
	for (const alt of reconciliation.alternatives ?? []) {
		if (alt && !lines.includes(`- ${alt}`)) {
			lines.push(`- ${alt}`);
		}
	}
	return lines.join("\n");
}

function readPackageVersion() {
	try {
		const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf-8"));
		return pkg.version || "unknown";
	} catch {
		return "unknown";
	}
}

/**
 * Render issue draft markdown sections for GitHub filing.
 *
 * @param {object} sections
 * @param {string} sections.summary
 * @param {string} sections.environment
 * @param {string} sections.commandsRun
 * @param {string} sections.diagnosis
 * @param {string} sections.journalExcerpt
 * @param {string} [sections.expected]
 * @param {string} [sections.actual]
 */
export function formatIssueDraftMarkdown(sections) {
	const lines = [
		"## Summary",
		sections.summary,
		"",
		"## Environment",
		sections.environment,
		"",
		"## Commands run",
		sections.commandsRun,
		"",
		"## Diagnosis",
		sections.diagnosis,
		"",
		"## Journal excerpt",
		sections.journalExcerpt,
		"",
		"## Expected",
		sections.expected ?? "(describe expected behavior)",
		"",
		"## Actual",
		sections.actual ?? "(describe actual behavior)",
		"",
	];
	return redactHandoffText(lines.join("\n"));
}

/**
 * Build a GitHub issue draft from live project state.
 *
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {"bug"|"enhancement"|"question"} [options.issueType]
 * @param {string} [options.title]
 * @param {string} [options.batchId]
 */
export function buildIssueDraftBody(options) {
	const { projectRoot, issueType = "bug", title, batchId } = options;
	if (!VALID_ISSUE_TYPES.has(issueType)) {
		throw new Error(`Invalid issueType: ${issueType} (expected bug, enhancement, or question)`);
	}

	const reconciliation = reconcileBatch({ projectRoot, verbose: true });
	const doctorResult = runDoctorChecks(projectRoot);
	const handoff = assembleHandoffData(projectRoot, batchId ?? reconciliation.batchId ?? undefined);
	const version = readPackageVersion();

	const sections = redactHandoffSecrets({
		summary: reconciliation.headline ?? "pi-spine operator issue draft",
		environment: [
			`- pi-spine version: ${version}`,
			`- Node: v${process.versions.node}`,
			"",
			formatDoctorSummary(doctorResult),
		].join("\n"),
		commandsRun: formatCommandsRun(reconciliation),
		diagnosis: formatDiagnosisBlock(reconciliation),
		journalExcerpt: formatJournalExcerpt(handoff),
		expected: "(describe expected behavior)",
		actual: "(describe actual behavior)",
	});

	const body = formatIssueDraftMarkdown(sections);
	const resolvedTitle = redactHandoffText(title ?? reconciliation.headline ?? "pi-spine issue");
	const labels = [ISSUE_TYPE_LABELS[issueType]];

	return {
		title: resolvedTitle,
		body,
		labels,
	};
}
