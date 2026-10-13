type HierarchyTask = { id: number; parentTaskId?: number | null };
export type TaskNode<T> = T & { subtasks: TaskNode<T>[] };

// Build from the visible results: a matching child must remain reachable even
// when its parent is excluded by a filter or absent from the API response.
export function buildTaskHierarchy<T extends HierarchyTask>(tasks: T[]): TaskNode<T>[] {
  const taskMap = new Map<number, TaskNode<T>>();
  const roots: TaskNode<T>[] = [];
  tasks.forEach(task => taskMap.set(task.id, { ...task, subtasks: [] }));
  tasks.forEach(task => {
    const node = taskMap.get(task.id)!;
    const parent = task.parentTaskId == null ? undefined : taskMap.get(task.parentTaskId);
    if (parent) {
      parent.subtasks.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}
