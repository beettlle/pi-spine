/**
 * FR-SCHED-02: detect dependency cycles.
 */

/**
 * @param {{ nodes: string[], depsByTask: Record<string, string[]> }} graph
 * @returns {string[] | null} cycle path like [A, B, C, A]
 */
export function findCyclePath(graph) {
	const visited = new Set();
	const inStack = new Set();
	const stack = [];
	const stackIndex = new Map();

	/** @type {(id: string) => string[] | null} */
	function dfs(id) {
		visited.add(id);
		inStack.add(id);
		stackIndex.set(id, stack.length);
		stack.push(id);

		const deps = graph.depsByTask[id] ?? [];
		for (const dep of deps) {
			const next = String(dep);
			if (!visited.has(next)) {
				const cycle = dfs(next);
				if (cycle) return cycle;
				continue;
			}

			if (inStack.has(next)) {
				const start = stackIndex.get(next);
				if (start == null) continue;
				const cycle = stack.slice(start).concat([next]);
				return cycle;
			}
		}

		stack.pop();
		inStack.delete(id);
		stackIndex.delete(id);
		return null;
	}

	for (const id of graph.nodes) {
		if (!visited.has(id)) {
			const cycle = dfs(id);
			if (cycle) return cycle;
		}
	}

	return null;
}

/**
 * @param {ReturnType<typeof import('./graph.mjs').buildGraph>} graph
 */
export function assertAcyclic(graph) {
	const cycle = findCyclePath(graph);
	if (cycle) {
		throw new Error('Dependency cycle detected: ' + cycle.join(' -> '));
	}
}
