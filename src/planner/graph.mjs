/**
 * FR-SCHED-01: build directed graph from dependencies and
 * produce topological waves.
 *
 * Dependencies are expressed as:
 *   depsByTask[taskId] = [dependencyTaskId, ...]
 *
 * All task IDs appearing either as a key or dependency will be
 * included in the graph.
 */

/**
 * @param {Record<string, string[]>} depsByTask
 * @returns {{ nodes: string[], depsByTask: Record<string, string[]>, dependentsByTask: Record<string, string[]> }}
 */
export function buildGraph(depsByTask) {
	const normalized = {};
	const dependentsByTask = {};
	const nodesSet = new Set();

	for (const [taskId, deps] of Object.entries(depsByTask)) {
		const id = String(taskId);
		nodesSet.add(id);
		const list = Array.from(new Set((deps ?? []).map(String)));
		normalized[id] = list;

		for (const dep of list) {
			nodesSet.add(dep);
			if (!dependentsByTask[dep]) dependentsByTask[dep] = [];
			if (!dependentsByTask[dep].includes(id)) dependentsByTask[dep].push(id);
		}
	}

	for (const id of nodesSet) {
		if (!normalized[id]) normalized[id] = [];
		if (!dependentsByTask[id]) dependentsByTask[id] = [];
	}

	const nodes = Array.from(nodesSet).sort();
	for (const id of Object.keys(dependentsByTask)) {
		dependentsByTask[id].sort();
	}

	return { nodes, depsByTask: normalized, dependentsByTask };
}

/**
 * Kahn-style topological sort that groups nodes into waves.
 *
 * Each wave contains nodes whose dependencies are satisfied by
 * earlier waves.
 *
 * @param {{ nodes: string[], depsByTask: Record<string, string[]>, dependentsByTask: Record<string, string[]> }} graph
 * @returns {{ waves: string[][], remainingWithDeps: string[] }}
 */
export function topoWaves(graph) {
	const indegree = new Map();

	for (const id of graph.nodes) {
		indegree.set(id, 0);
	}

	// indegree counts number of unsatisfied dependencies for each node
	for (const [taskId, deps] of Object.entries(graph.depsByTask)) {
		indegree.set(taskId, (deps ?? []).length);
	}

	const zero = Array.from(indegree.entries())
		.filter(([, deg]) => deg === 0)
		.map(([id]) => id)
		.sort();

	const waves = [];
	let current = zero;

	while (current.length > 0) {
		waves.push(current);
		const next = [];

		for (const id of current) {
			const dependents = graph.dependentsByTask[id] ?? [];
			for (const dependent of dependents) {
				const prev = indegree.get(dependent) ?? 0;
				const nextDeg = prev - 1;
				indegree.set(dependent, nextDeg);
				if (nextDeg === 0) next.push(dependent);
			}
		}

		current = next.sort();
	}

	const remainingWithDeps = Array.from(indegree.entries())
		.filter(([, deg]) => deg > 0)
		.map(([id]) => id)
		.sort();

	return { waves, remainingWithDeps };
}
