import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTaskHierarchy, groupProjectTasks } from "./task-hierarchy";

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

test("reopening one subtask keeps the completed parent and sibling in the archive", () => {
  const tasks = [
    { id: 1, title: "Permit filing", parentTaskId: null, status: "done" },
    { id: 2, title: "Review drawings", parentTaskId: 1, status: "done" },
    { id: 3, title: "Confirm fees", parentTaskId: 1, status: "done" },
  ];

  const before = groupProjectTasks(tasks);
  assert.deepEqual(before.activeTasks, []);
  assert.equal(before.archivedCount, 3);
  assert.deepEqual(before.archivedTasks[0].subtasks.map(task => task.id), [2, 3]);

  tasks[1].status = "todo";
  const { activeTasks, archivedTasks, archivedCount } = groupProjectTasks(tasks);

  assert.deepEqual(activeTasks.map(task => task.id), [2]);
  assert.equal(activeTasks[0].parentTaskId, 1);
  assert.equal(activeTasks[0].parentTaskTitle, "Permit filing");
  assert.equal(archivedCount, 2);
  assert.deepEqual(archivedTasks.map(task => task.id), [1]);
  assert.deepEqual(archivedTasks[0].subtasks.map(task => task.id), [3]);
  assert.equal(archivedTasks[0].completedSubtaskCount, 1);
  assert.equal(archivedTasks[0].subtaskCount, 2);
});

test("completed and cancelled subtasks remain reachable under an active parent", () => {
  const tasks = [
    { id: 1, title: "Permit filing", parentTaskId: null, status: "in_progress" },
    { id: 2, title: "Review drawings", parentTaskId: 1, status: "done" },
    { id: 3, title: "Confirm fees", parentTaskId: 1, status: "cancelled" },
    { id: 4, title: "Check site plan", parentTaskId: 2, status: "todo" },
  ];
  const original = structuredClone(tasks);

  const { activeTasks, archivedTasks, archivedCount } = groupProjectTasks(tasks);

  assert.deepEqual(activeTasks.map(task => task.id), [1, 4]);
  assert.equal(activeTasks[1].parentTaskTitle, "Review drawings");
  assert.equal(activeTasks[0].completedSubtaskCount, 1);
  assert.equal(activeTasks[0].subtaskCount, 2);
  assert.deepEqual(archivedTasks.map(task => task.id), [2, 3]);
  assert.equal(archivedCount, 2);
  assert.equal(archivedTasks[0].parentTaskTitle, "Permit filing");
  assert.deepEqual(tasks, original);
});
