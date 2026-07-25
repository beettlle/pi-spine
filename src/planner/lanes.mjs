/**
 * FR-SCHED-03/04: greedy lane assignment subject to file-scope disjointness.
 *
 * NOTE (SP-689 / issue #226): This module previously held a divergent copy of
 * `assignLanesToWaves` whose overlap detection was directory-prefix only
 * (normalizeFileScopePath + pathsOverlap). The production planner calls
 * `planWaves` from `waves.mjs`, whose `assignLanesToWaves` uses the glob-aware
 * `fileScopesOverlap` from `file-scope.mjs` — a strict superset of the logic
 * that lived here. This module was imported only by tests, so the duplicate has
 * been collapsed into a thin re-export of the canonical implementation to keep a
 * single source of truth. Packing semantics are unchanged.
 */

export { assignLanesToWaves } from './waves.mjs';
