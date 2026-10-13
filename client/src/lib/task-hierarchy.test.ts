import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTaskHierarchy } from "./task-hierarchy";

test("shows all three matching subtasks when their parents are filtered out", () => {
  const tasks = [1, 2, 3].map(id => ({ id, parentTaskId: 10 + id }));
  assert.deepEqual(buildTaskHierarchy(tasks).map(t => t.id), [1, 2, 3]);
});

test("keeps matching parents and children nested without duplicates", () => {
  const tree = buildTaskHierarchy([{ id: 2, parentTaskId: 1 }, { id: 1, parentTaskId: null }]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].id, 1);
  assert.deepEqual(tree[0].subtasks.map(t => t.id), [2]);
});

test("preserves nested descendants when a filtered ancestor is absent", () => {
  const tree = buildTaskHierarchy([{ id: 2, parentTaskId: 1 }, { id: 3, parentTaskId: 2 }]);
  assert.equal(tree[0].id, 2);
  assert.equal(tree[0].subtasks[0].id, 3);
});

test("handles empty results", () => assert.deepEqual(buildTaskHierarchy([]), []));

test("does not mutate API task records", () => {
  const tasks = [{ id: 1, parentTaskId: null }, { id: 2, parentTaskId: 1 }];
  const original = structuredClone(tasks);
  buildTaskHierarchy(tasks);
  assert.deepEqual(tasks, original);
});
