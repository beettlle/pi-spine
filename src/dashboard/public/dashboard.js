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

	if (banner.idle || !banner.diagnosis) {
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
	$("wave-progress-summary").textContent =
		waves.totalWaves > 0
			? `Wave ${waves.currentWaveIndex + 1} of ${waves.totalWaves} — lane ≠ wave (see Lanes table)`
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

/** @param {ReturnType<typeof buildDashboardViewModel>["lanes"]} lanes */
function renderLanes(lanes) {
	const tbody = $("lane-table-body");
	tbody.replaceChildren();
	if (!lanes.length) {
		const tr = document.createElement("tr");
		const td = document.createElement("td");
		td.colSpan = 6;
		td.className = "empty-hint";
		td.textContent = "No lanes";
		tr.appendChild(td);
		tbody.appendChild(tr);
		return;
	}
	for (const lane of lanes) {
		const tr = document.createElement("tr");
		const statusLabel =
			lane.laneAlert === "checkpoint-warning"
				? `${lane.status} · checkpoint warning`
				: lane.laneAlert === "stall-killed"
					? `${lane.status} · stall killed`
					: lane.status;
		const values = [
			lane.laneId,
			statusLabel,
			(lane.activeTaskIds ?? []).join(", ") || "—",
			(lane.taskIds ?? []).join(", ") || "—",
			formatHeartbeat(lane.heartbeatAgeSeconds),
			lane.worktree ?? "—",
		];
		values.forEach((text, index) => {
			const td = document.createElement("td");
			td.textContent = text;
			if (index === 1) {
				td.className = `lane-status-${lane.status}`;
				if (lane.laneAlert === "checkpoint-warning") td.classList.add("lane-alert-checkpoint");
				if (lane.laneAlert === "stall-killed") td.classList.add("lane-alert-stall");
			}
			tr.appendChild(td);
		});
		tbody.appendChild(tr);
	}
}

/** @param {ReturnType<typeof buildDashboardViewModel>["gate"]} gate */
function renderGate(gate) {
	const panel = $("gate-panel");
	panel.replaceChildren();
	if (!gate) {
		const p = document.createElement("p");
		p.className = "empty-hint";
		p.textContent = "No active gate";
		panel.appendChild(p);
		return;
	}
	const status = document.createElement("p");
	status.innerHTML = `<span class="gate-status">${gate.status}</span> · ${gate.kind ?? ""}`;
	panel.appendChild(status);
	if (gate.summary) {
		const p = document.createElement("p");
		p.textContent = gate.summary;
		panel.appendChild(p);
	}
	if (gate.openedAt) {
		const p = document.createElement("p");
		p.textContent = `Opened: ${formatTs(gate.openedAt)}`;
		panel.appendChild(p);
	}
}

/** @param {ReturnType<typeof buildDashboardViewModel>["journal"]} journal */
function renderJournal(journal) {
	const list = $("journal-list");
	list.replaceChildren();
	if (!journal.length) {
		const li = document.createElement("li");
		li.className = "empty-hint";
		li.textContent = "No journal events";
		list.appendChild(li);
		return;
	}
	for (const entry of journal) {
		const li = document.createElement("li");
		li.textContent = `${formatTs(entry.timestamp)} · ${entry.type}: ${entry.summary}`;
		list.appendChild(li);
	}
}

/** @param {object} snapshot */
export function renderSnapshot(snapshot) {
	const vm = buildDashboardViewModel(snapshot);
	$("active-panels").hidden = vm.idle;
	renderBanner(vm);
	if (!vm.idle) {
		renderBatch(vm.batch);
		renderWaves(vm.waves);
		renderLanes(vm.lanes);
		renderGate(vm.gate);
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
