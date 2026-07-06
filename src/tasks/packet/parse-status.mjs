// @ts-nocheck
const HEADER_FIELD_RE = /^\*\*([^*]+):\*\*\s*(.+)$/gm;
const STEP_SECTION_RE = /^### Step (\d+): (.+)$/gm;
const CHECKBOX_RE = /^-\s+\[([ xX])\]\s+(.+)$/gm;
const STEP_STATUS_RE = /^\*\*Status:\*\*\s*(.+)$/m;

/**
 * @param {string} markdown STATUS.md contents
 */
export function parseStatus(markdown) {
	const header = {};
	let match;
	HEADER_FIELD_RE.lastIndex = 0;
	while ((match = HEADER_FIELD_RE.exec(markdown)) !== null) {
		header[match[1].trim()] = match[2].trim();
	}

	const steps = [];
	const stepMatches = [...markdown.matchAll(STEP_SECTION_RE)];

	for (let i = 0; i < stepMatches.length; i++) {
		const number = Number(stepMatches[i][1]);
		const title = stepMatches[i][2].trim();
		const start = stepMatches[i].index + stepMatches[i][0].length;
		const end = i + 1 < stepMatches.length ? stepMatches[i + 1].index : markdown.length;
		const body = markdown.slice(start, end);

		const statusMatch = STEP_STATUS_RE.exec(body);
		const status = statusMatch?.[1]?.trim() ?? "";
		const checkboxes = parseCheckboxes(body);

		steps.push({
			number,
			title,
			status,
			statusKind: classifyStepStatus(status),
			checkboxes,
		});
	}

	return { header, steps };
}

/**
 * @param {ReturnType<typeof parseStatus>} status
 */
export function getStepProgress(status) {
	let total = 0;
	let completed = 0;
	const steps = [];

	for (const step of status.steps) {
		const stepTotal = step.checkboxes.length;
		const stepCompleted = step.checkboxes.filter((cb) => cb.checked).length;
		total += stepTotal;
		completed += stepCompleted;
		steps.push({
			number: step.number,
			title: step.title,
			statusKind: step.statusKind,
			total: stepTotal,
			completed: stepCompleted,
			complete: stepTotal > 0 && stepCompleted === stepTotal,
		});
	}

	return {
		total,
		completed,
		percent: total === 0 ? 0 : Math.round((completed / total) * 100),
		steps,
	};
}

/**
 * @param {ReturnType<typeof parseStatus>} status
 */
export function listIncompleteSteps(status) {
	const incomplete = [];

	for (const step of status.steps) {
		const unchecked = step.checkboxes.filter((cb) => !cb.checked);
		if (unchecked.length === 0) continue;
		incomplete.push({
			number: step.number,
			title: step.title,
			unchecked: unchecked.map((cb) => ({ text: cb.text })),
		});
	}

	return incomplete;
}

/**
 * @param {string} body
 */
function parseCheckboxes(body) {
	const checkboxes = [];
	let match;
	CHECKBOX_RE.lastIndex = 0;
	while ((match = CHECKBOX_RE.exec(body)) !== null) {
		checkboxes.push({
			checked: match[1].toLowerCase() === "x",
			text: match[2].trim(),
		});
	}
	return checkboxes;
}

/**
 * @param {string} statusText
 * @returns {'complete' | 'in-progress' | 'not-started'}
 */
function classifyStepStatus(statusText) {
	const lower = statusText.toLowerCase();
	if (statusText.includes("✅") || lower.includes("complete")) return "complete";
	if (statusText.includes("🟨") || lower.includes("progress")) return "in-progress";
	return "not-started";
}
