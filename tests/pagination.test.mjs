import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllPages } from '../src/utils/pagination.ts';

test('loads beyond ten records when the server caps each response', async () => {
  const all = Array.from({ length: 35 }, (_, id) => ({ id }));
  const offsets = [];
  const result = await fetchAllPages(async offset => {
    offsets.push(offset);
    return { data: all.slice(offset, offset + 10), count: all.length };
  });
  assert.deepEqual(result, all);
  assert.deepEqual(offsets, [0, 10, 20, 30]);
});
test('loads more than the API default limit using consecutive pages', async () => {
  const all = Array.from({ length: 1012 }, (_, id) => id);
  assert.deepEqual(await fetchAllPages(async (offset, size) => ({ data: all.slice(offset, offset + size), count: all.length })), all);
});
test('without count metadata, keeps fetching until an empty response', async () => {
  const all = [1, 2, 3, 4, 5];
  assert.deepEqual(await fetchAllPages(async offset => ({ data: all.slice(offset, offset + 2), count: null })), all);
});
test('empty history ends and a failed page does not return partial results', async () => {
  assert.deepEqual(await fetchAllPages(async () => ({ data: [], count: 0 })), []);
  await assert.rejects(fetchAllPages(async offset => {
    if (offset) throw new Error('network');
    return { data: [1], count: 2 };
  }), /network/);
});
