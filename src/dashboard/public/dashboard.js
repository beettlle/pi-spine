import { buildDashboardViewModel } from "/view.mjs";

/** @param {string} id */
const $ = (id) => document.getElementById(id);

/** @param {number|string|null|undefined} value */
function formatTs(value) {
	if (value == null) return "—";
	const d = typeof value === "number" ? new Date(value) : new Date(String(value));
	return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

/** @param {number|null|undefined} age */
function formatHeartbeat(age) {
	if (age == null) return "—";
	return `${age}s`;
}

/** @param {{ heartbeatDisplay?: string|null, heartbeatAgeSeconds?: number|null }} lane */
function displayHeartbeat(lane) {
	if (lane.heartbeatDisplay != null) return lane.heartbeatDisplay;
	return formatHeartbeat(lane.heartbeatAgeSeconds);
}

/** @param {"connecting"|"live"|"error"} state @param {string} text */
function setConnection(state, text) {
	const el = $("connection-status");
	el.dataset.state = state;
	el.textContent = text;
}

/** @param {string} command */
async function copyCommand(command) {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(command);
		return;
	}
	const textarea = document.createElement("textarea");
	textarea.value = command;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "absolute";
	textarea.style.left = "-9999px";
	document.body.appendChild(textarea);
	textarea.select();
	document.execCommand("copy");
	textarea.remove();
}

/**
 * @param {HTMLElement} chip
 * @param {string} command
 */
async function handleChipCopy(chip, command) {
	try {
		await copyCommand(command);
		chip.classList.add("action-chip-copied");
		chip.setAttribute("aria-label", `Copied: ${command}`);
		setTimeout(() => {
			chip.classList.remove("action-chip-copied");
			chip.setAttribute("aria-label", `Copy command: ${command}`);
		}, 1200);
	} catch (err) {
		console.error("Failed to copy command", err);
	}
}

/** @param {ReturnType<typeof buildDashboardViewModel>} vm */
function renderBanner(vm) {
	const badge = $("banner-badge");
	const headline = $("banner-headline");
	const actions = $("banner-actions");
	const banner = vm.banner;

	headline.textContent = banner.headline;

	if (!banner.diagnosis) {
		badge.hidden = true;
		badge.className = "badge badge-idle";
	} else {
		badge.hidden = false;
		badge.className = `badge ${banner.badgeClass}`;
		badge.textContent = banner.diagnosis.replace(/_/g, " ");
	}

	actions.replaceChildren();
	const chips = banner.actionChips ?? [];
	if (!chips.length) {
		actions.hidden = true;
		return;
	}

	actions.hidden = false;
	for (const chip of chips) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = chip.primary ? "action-chip action-chip-primary" : "action-chip";
		btn.setAttribute("aria-label", `Copy command: ${chip.command}`);

		const labelEl = document.createElement("span");
		labelEl.className = "action-chip-label";
		labelEl.textContent = chip.label;

		const cmdEl = document.createElement("span");
		cmdEl.className = "action-chip-command";
		cmdEl.textContent = chip.command;

		btn.append(labelEl, cmdEl);
		btn.addEventListener("click", () => {
			void handleChipCopy(btn, chip.command);
		});
		actions.appendChild(btn);
	}
}

/** @param {HTMLDListElement} dl @param {string} key @param {string|number|null|undefined} value */
function appendKv(dl, key, value) {
	if (value == null || value === "") return;
	const dt = document.createElement("dt");
	dt.textContent = key;
	const dd = document.createElement("dd");
	dd.textContent = String(value);
	dl.appendChild(dt);
	dl.appendChild(dd);
}

/** @param {ReturnType<typeof buildDashboardViewModel>["batch"]} batch */
function renderBatch(batch) {
	const dl = $("batch-summary");
	dl.replaceChildren();
	if (!batch) return;
	appendKv(dl, "Batch ID", batch.batchId);
	appendKv(dl, "Phase", batch.phase);
	appendKv(dl, "Macro phase", batch.macroPhaseLabel);
	appendKv(dl, "Base", batch.baseBranch);
	appendKv(dl, "Orch", batch.orchBranch);
	appendKv(dl, "Started", formatTs(batch.startedAt));
	appendKv(dl, "Ended", formatTs(batch.endedAt));
	appendKv(
		dl,
		"Tasks",
		`${batch.taskCounts.succeeded}/${batch.taskCounts.total} ok, ${batch.taskCounts.failed} failed`,
	);
}

/** @param {ReturnType<typeof buildDashboardViewModel>["waves"]} waves */
function renderWaves(waves) {
	const macroSuffix = waves.macroPhaseLabel ? ` · ${waves.macroPhaseLabel}` : "";
	$("wave-progress-summary").textContent =
		waves.totalWaves > 0
			? `Wave ${waves.currentWaveIndex + 1} of ${waves.totalWaves}${macroSuffix} — lane ≠ wave (see Lanes table)`
			: waves.macroPhaseLabel
				? `${waves.macroPhaseLabel} — no waves`
				: "No waves";
	const list = $("wave-list");
	list.replaceChildren();
	for (const wave of waves.waves) {
		const li = document.createElement("li");
		li.dataset.status = wave.status;
		li.textContent = `Wave ${wave.index + 1} [${wave.status}]: ${wave.taskIds.join(", ") || "(empty)"}`;
		list.appendChild(li);
	}
}

/**
 * Running cell text. Shows the task title alongside the id when the snapshot
 * payload resolved one (PRD §16, #214); falls back to the id-only form when the
 * title is unavailable so the cell never goes blank.
 *
 * @param {string|null|undefined} taskId
 * @param {string|null|undefined} title
 */
function formatRunningCell(taskId, title) {
	if (!taskId) return "—";
	return title ? `▶ ${taskId} — ${title}` : `▶ ${taskId}`;
}

/** @param {string[]} taskIds */
function formatQueuedCell(taskIds) {
	if (!taskIds?.length) return "—";
	return taskIds.map((id) => `○ ${id}`).join(", ");
}

/**
 * Accessible label for the running cell. Mirrors the visible text so screen
 * readers announce the task title, not just the id.
 *
 * @param {string|null|undefined} taskId
 * @param {string|null|undefined} title
 */
function runningCellAriaLabel(taskId, title) {
	if (!taskId) return "No running task";
	return title ? `Running task ${taskId} — ${title}` : `Running task ${taskId}`;
}

/** @param {string[]} taskIds */
function queuedCellAriaLabel(taskIds) {
	const count = taskIds?.length ?? 0;
	if (count === 0) return "No tasks waiting in lane queue";
	if (count === 1) return "1 task waiting in lane queue";
	return `${count} tasks waiting in lane queue`;
}

/** @param {HTMLElement} td @param {string} text @param {string} className @param {string} ariaLabel */
function appendLaneTextCell(td, text, className, ariaLabel) {
	td.textContent = text;
	td.className = className;
	td.setAttribute("aria-label", ariaLabel);
}

/** @param {ReturnType<typeof buildDashboardViewModel>["lanes"]} lanes @param {ReturnType<typeof buildDashboardViewModel>["laneTableSummary"]} laneTableSummary @param {ReturnType<typeof buildDashboardViewModel>["tailActivity"]} tailActivity @param {string|null} expandedLaneId */
function renderLanes(lanes, laneTableSummary, tailActivity, expandedLaneId) {
	const tbody = $("lane-table-body");
	tbody.replaceChildren();
	const columnCount = 11;
	const maxQueuedCount = lanes.reduce(
		(max, lane) => Math.max(max, lane.queuedCount ?? lane.queuedTaskIds?.length ?? 0),
		0,
	);
	const queuedHeading = $("lane-queued-heading");
	if (queuedHeading) {
		queuedHeading.textContent =
			maxQueuedCount > 0 ? `Queued (${maxQueuedCount})` : "Queued";
	}
	if (!lanes.length) {
		const tr = document.createElement("tr");
		const td = document.createElement("td");
		td.colSpan = columnCount;
		td.className = "empty-hint";
		td.textContent = "No lanes";
		tr.appendChild(td);
		tbody.appendChild(tr);
		return;
	}
	// The lane-table VM projection (view.mjs) does not carry the title, so look it
	// up from the raw snapshot payload where Step 0 attaches `runningTaskTitle`.
	/** @type {Map<string, string>} */
	const runningTitleById = new Map();
	for (const rawLane of lastSnapshot?.lanes ?? []) {
		if (rawLane?.runningTaskId != null && rawLane.runningTaskTitle) {
			runningTitleById.set(String(rawLane.runningTaskId), rawLane.runningTaskTitle);
		}
	}
	for (const lane of lanes) {
		const tr = document.createElement("tr");
		tr.className = "lane-row";
		if (lane.laneId === expandedLaneId) {
			tr.classList.add("lane-row-expanded");
		}
		tr.dataset.laneId = lane.laneId;
		tr.setAttribute("aria-expanded", lane.laneId === expandedLaneId ? "true" : "false");
		const throughput = lane.throughput ?? {};
		const isTerminalFailure = lane.activityPhase === "failed";
		// Completed lanes use terminal outcome only; failedCount stays a retry metric.
		const isTaskFailed =
			lane.status === "completed"
				? isTerminalFailure
				: (throughput.failedCount ?? 0) > 0 || isTerminalFailure;
		const isTaskSucceeded = lane.status === "completed" && !isTaskFailed;
		const isTaskRunning = lane.status === "running" && !isTaskFailed;
		if (isTaskFailed) tr.classList.add("task-failed");
		else if (isTaskSucceeded) tr.classList.add("task-succeeded");
		else if (isTaskRunning) tr.classList.add("task-running");
		let statusLabel;
		if (isTaskFailed) {
			const failedEvent = (lane.detail?.recentEvents ?? []).find((e) => e.type === "task.failed");
			const rawReason = failedEvent?.summary ?? "";
			const exitReason = rawReason.split("→")[0].replace(/,\s*$/, "").trim();
			statusLabel = exitReason ? `❌ FAILED — ${exitReason}` : "❌ FAILED";
		} else if (isTaskSucceeded) {
			statusLabel = "✅ Done";
		} else if (lane.laneAlert === "checkpoint-warning") {
			statusLabel = `${lane.status} · checkpoint warning`;
		} else if (lane.laneAlert === "stall-killed") {
			statusLabel = `${lane.status} · stall killed`;
		} else {
			statusLabel = lane.status;
		}
		const runningTitle =
			lane.runningTaskId != null
				? runningTitleById.get(String(lane.runningTaskId))
				: undefined;
		const runningText = formatRunningCell(lane.runningTaskId, runningTitle);
		const queuedText = formatQueuedCell(lane.queuedTaskIds ?? []);
		const cellSpecs = [
			{ text: lane.laneId, className: "", ariaLabel: null },
			{ text: statusLabel, className: `lane-status-${lane.status}`, ariaLabel: null, statusCell: true },
			{ text: lane.activityPhaseLabel ?? "—", className: "", ariaLabel: null },
			{
				text: runningText,
				className: "lane-task-running",
				ariaLabel: runningCellAriaLabel(lane.runningTaskId, runningTitle),
			},
			{
				text: queuedText,
				className: "lane-task-queued",
				ariaLabel: queuedCellAriaLabel(lane.queuedTaskIds ?? []),
			},
			{ text: (lane.taskIds ?? []).join(", ") || "—", className: "", ariaLabel: null },
			{ text: displayHeartbeat(lane), className: "", ariaLabel: null },
			{ text: throughput.elapsedDisplay ?? "—", className: "", ariaLabel: null },
			{ text: throughput.doneDisplay ?? "—", className: "", ariaLabel: null },
			{ text: throughput.rateDisplay ?? "—", className: "", ariaLabel: null },
			{ text: lane.worktree ?? "—", className: "", ariaLabel: null },
		];
		cellSpecs.forEach((spec, index) => {
			const td = document.createElement("td");
			if (spec.ariaLabel) {
				appendLaneTextCell(td, spec.text, spec.className, spec.ariaLabel);
			} else {
				td.textContent = spec.text;
				if (spec.className) td.className = spec.className;
			}
			if (index === 1) {
				if (lane.laneAlert === "checkpoint-warning") td.classList.add("lane-alert-checkpoint");
				if (lane.laneAlert === "stall-killed") td.classList.add("lane-alert-stall");
			}
			if (index === 3) td.classList.add("col-running");
			if (index === 4) td.classList.add("col-queued");
			tr.appendChild(td);
		});
		tr.addEventListener("click", () => {
			expandedLaneIdState = expandedLaneIdState === lane.laneId ? null : lane.laneId;
			if (lastSnapshot) renderSnapshot(lastSnapshot);
		});
		tbody.appendChild(tr);

		if (lane.laneId === expandedLaneId) {
			const detailRow = document.createElement("tr");
			detailRow.className = "lane-detail-row";
			const detailCell = document.createElement("td");
			detailCell.colSpan = columnCount;
			detailCell.appendChild(renderLaneDetailPanel(lane));
			detailRow.appendChild(detailCell);
			tbody.appendChild(detailRow);
		}
	}
	if (laneTableSummary) {
		const tr = document.createElement("tr");
		tr.className = "lane-table-summary";
		const values = [
			"All lanes",
			"—",
			"—",
			"—",
			"—",
			"—",
			"—",
			laneTableSummary.elapsedDisplay ?? "—",
			laneTableSummary.doneDisplay ?? "—",
			laneTableSummary.rateDisplay ?? "—",
			"—",
		];
		values.forEach((text) => {
			const td = document.createElement("td");
			td.textContent = text;
			tr.appendChild(td);
		});
		tbody.appendChild(tr);
	}
	if (tailActivity?.visible && tailActivity.tailActivityLabel) {
		const tr = document.createElement("tr");
		tr.className = "lane-table-tail-activity";
		const td = document.createElement("td");
		td.colSpan = columnCount;
		td.className = "empty-hint lane-tail-activity";
		td.textContent = tailActivity.tailActivityLabel;
		td.setAttribute("aria-label", `Batch activity: ${tailActivity.tailActivityLabel}`);
		tr.appendChild(td);
		tbody.appendChild(tr);
	}
}

/** @param {ReturnType<typeof buildDashboardViewModel>["lanes"][number]} lane */
function renderLaneDetailPanel(lane) {
	const panel = document.createElement("div");
	panel.className = "lane-detail-panel";

	const eventsSection = document.createElement("section");
	eventsSection.className = "lane-detail-section";
	const eventsHeading = document.createElement("h4");
	eventsHeading.textContent = "Recent journal (5)";
	eventsSection.appendChild(eventsHeading);
	const eventsList = document.createElement("ol");
	eventsList.className = "lane-detail-events";
	const recentEvents = lane.detail?.recentEvents ?? [];
	if (!recentEvents.length) {
		const li = document.createElement("li");
		li.className = "empty-hint";
		li.textContent = "No lane events";
		eventsList.appendChild(li);
	} else {
		for (const entry of recentEvents) {
			const li = document.createElement("li");
			li.textContent = `${formatTs(entry.timestamp)} · ${entry.type}: ${entry.summary}`;
			eventsList.appendChild(li);
		}
	}
	eventsSection.appendChild(eventsList);

	const logSection = document.createElement("section");
	logSection.className = "lane-detail-section";
	const logHeading = document.createElement("h4");
	logHeading.textContent = "Worker log (10 lines)";
	logSection.appendChild(logHeading);
	if (lane.detail?.workerLogRef) {
		const logRef = document.createElement("p");
		logRef.className = "lane-detail-log-ref";
		logRef.textContent = lane.detail.workerLogRef;
		logSection.appendChild(logRef);
	}
	const logLines = lane.detail?.logTail ?? [];
	if (!logLines.length) {
		const empty = document.createElement("p");
		empty.className = "empty-hint";
		empty.textContent = "No log output";
		logSection.appendChild(empty);
	} else {
		const pre = document.createElement("pre");
		pre.textContent = logLines.join("\n");
		logSection.appendChild(pre);
	}

	panel.append(eventsSection, logSection);
	return panel;
}

/** @param {ReturnType<typeof buildDashboardViewModel>["journal"]} journal @param {HTMLElement} listEl */
function renderJournalList(listEl, journal) {
	listEl.replaceChildren();
	if (!journal.length) {
		const li = document.createElement("li");
		li.className = "empty-hint";
		li.textContent = "No journal events";
		listEl.appendChild(li);
		return;
	}
	for (const entry of journal) {
		const li = document.createElement("li");
		li.textContent = `${formatTs(entry.timestamp)} · ${entry.type}: ${entry.summary}`;
		listEl.appendChild(li);
	}
}

/** @param {ReturnType<typeof buildDashboardViewModel>["gateAffordance"]} gateAffordance */
function renderGatePanel(gateAffordance) {
	const section = $("gate-panel-section");
	const panel = $("gate-panel");
	panel.replaceChildren();

	if (!gateAffordance?.visible) {
		section.hidden = true;
		return;
	}

	section.hidden = false;

	const status = document.createElement("p");
	const statusClass =
		gateAffordance.status === "approved"
			? "gate-status-approved"
			: gateAffordance.status === "rejected"
				? "gate-status-rejected"
				: "gate-status-pending";
	const badge = document.createElement("span");
	badge.className = `gate-status ${statusClass}`;
	badge.textContent = gateAffordance.status;
	status.appendChild(badge);
	status.appendChild(document.createTextNode(" · "));
	status.appendChild(document.createTextNode(gateAffordance.kind ?? "integrate"));
	panel.appendChild(status);

	if (gateAffordance.summary) {
		const summary = document.createElement("p");
		summary.textContent = gateAffordance.summary;
		panel.appendChild(summary);
	}

	if (gateAffordance.openedAt) {
		const opened = document.createElement("p");
		opened.textContent = `Opened: ${formatTs(gateAffordance.openedAt)}`;
		panel.appendChild(opened);
	}
}

/**
 * Default view panels: integrate gate when applicable.
 *
 * @param {ReturnType<typeof buildDashboardViewModel>} vm
 */
function renderDefaultStatusPanels(vm) {
	const section = $("default-status-panels");
	const showGate = vm.gateAffordance?.visible;

	if (!showGate) {
		section.hidden = true;
		return;
	}

	section.hidden = false;
	renderGatePanel(vm.gateAffordance);
}

/** @param {ReturnType<typeof buildDashboardViewModel>["journalLaneFilterOptions"]} options */
function renderJournalLaneFilter(options) {
	const select = $("journal-lane-filter");
	const current = journalLaneFilterState;
	select.replaceChildren();
	const allOption = document.createElement("option");
	allOption.value = "";
	allOption.textContent = "All lanes";
	select.appendChild(allOption);
	for (const option of options ?? []) {
		const el = document.createElement("option");
		el.value = option.laneId;
		el.textContent = option.label;
		select.appendChild(el);
	}
	select.value = current ?? "";
	if (!select.dataset.bound) {
		select.dataset.bound = "1";
		select.addEventListener("change", () => {
			journalLaneFilterState = select.value || null;
			if (lastSnapshot) renderSnapshot(lastSnapshot);
		});
	}
}

/** @param {ReturnType<typeof buildDashboardViewModel>["journal"]} journal */
function renderJournal(journal) {
	renderJournalList($("journal-list"), journal);
}

/** @type {object|null} */
let lastSnapshot = null;
/** @type {string|null} */
let expandedLaneIdState = null;
/** @type {string|null} */
let journalLaneFilterState = null;

/** @param {object} snapshot */
export function renderSnapshot(snapshot) {
	lastSnapshot = snapshot;
	const vm = buildDashboardViewModel(snapshot, { journalLaneFilter: journalLaneFilterState });
	$("active-panels").hidden = vm.idle;
	renderBanner(vm);
	renderDefaultStatusPanels(vm);
	if (!vm.idle) {
		renderBatch(vm.batch);
		renderWaves(vm.waves);
		renderLanes(vm.lanes, vm.laneTableSummary, vm.tailActivity, expandedLaneIdState);
		renderJournalLaneFilter(vm.journalLaneFilterOptions);
		renderJournal(vm.journal);
	}
	$("snapshot-time").textContent = vm.generatedAt ? `Snapshot: ${vm.generatedAt}` : "";
}

let eventSource = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let reconnectTimer = null;

function connectSse() {
	if (eventSource) {
		eventSource.close();
		eventSource = null;
	}
	setConnection("connecting", "Connecting…");
	eventSource = new EventSource("/api/events");
	eventSource.onopen = () => {
		setConnection("live", "Live · SSE");
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
	};
	eventSource.onmessage = (event) => {
		try {
			renderSnapshot(JSON.parse(event.data));
		} catch (err) {
			console.error("Failed to parse SSE snapshot", err);
		}
	};
	eventSource.onerror = () => {
		setConnection("error", "Connection lost — reconnecting…");
		eventSource?.close();
		eventSource = null;
		if (!reconnectTimer) {
			reconnectTimer = setTimeout(() => {
				reconnectTimer = null;
				connectSse();
			}, 2000);
		}
	};
}

connectSse();
