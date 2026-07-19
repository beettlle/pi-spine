import test from 'node:test';
import assert from 'node:assert';
import { parseMatrixTable, deriveMatrixRowId } from '../../src/planner/matrix.mjs';

test('parseMatrixTable: valid table', () => {
	const md = `
| run_id | lang | env     |
|--------|------|---------|
| a      | node | browser |
| b      | go   | native  |
`;
	const result = parseMatrixTable(md);
	assert.deepStrictEqual(result.columns, ['run_id', 'lang', 'env']);
	assert.strictEqual(result.rows.length, 2);
	assert.strictEqual(result.rows[0]['run_id'], 'a');
	assert.strictEqual(result.rows[0]['lang'], 'node');
	assert.strictEqual(result.rows[0]['env'], 'browser');
	assert.strictEqual(result.rows[1]['run_id'], 'b');
	assert.strictEqual(result.rows[1]['lang'], 'go');
	assert.strictEqual(result.rows[1]['env'], 'native');
});

test('parseMatrixTable: empty or malformed table', () => {
	assert.deepStrictEqual(parseMatrixTable(''), { rows: [], columns: [] });
	assert.deepStrictEqual(parseMatrixTable('no table here'), { rows: [], columns: [] });
	assert.deepStrictEqual(parseMatrixTable('| single line |\n'), { rows: [], columns: [] });
});

test('parseMatrixTable: handles empty cells', () => {
	const md = `
| run_id | val |
|--------|-----|
| a      |     |
| b      | foo |
`;
	const result = parseMatrixTable(md);
	assert.strictEqual(result.rows[0]['run_id'], 'a');
	assert.strictEqual(result.rows[0]['val'], '');
	assert.strictEqual(result.rows[1]['val'], 'foo');
});

test('deriveMatrixRowId: prefers run_id', () => {
	const id = deriveMatrixRowId({ run_id: 'test-1', other: 'foo' }, ['run_id', 'other']);
	assert.strictEqual(id, 'test-1');
});

test('deriveMatrixRowId: fallbacks to values', () => {
	const id = deriveMatrixRowId({ a: 'foo', b: 'bar-baz' }, ['a', 'b']);
	assert.strictEqual(id, 'foo_bar-baz');
});
