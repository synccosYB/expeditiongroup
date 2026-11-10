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

type ProjectTaskSummary = {
  parentTaskTitle?: string;
  subtaskCount: number;
  completedSubtaskCount: number;
};

export type ProjectTaskNode<T> = TaskNode<T & ProjectTaskSummary>;

function isArchivedStatus(status: string) {
  return status === "done" || status === "cancelled";
}

export function groupProjectTasks<T extends HierarchyTask & { status: string; title: string }>(tasks: T[]) {
  const projectTasks: (T & ProjectTaskSummary)[] = tasks.map(task => ({
    ...task,
    subtaskCount: 0,
    completedSubtaskCount: 0,
  }));
  const tasksById = new Map(projectTasks.map(task => [task.id, task]));
  const active: (T & ProjectTaskSummary)[] = [];
  const archived: (T & ProjectTaskSummary)[] = [];

  for (const task of projectTasks) {
    const isArchived = isArchivedStatus(task.status);
    const parent = task.parentTaskId == null ? undefined : tasksById.get(task.parentTaskId);
    if (parent) {
      parent.subtaskCount += 1;
      if (task.status === "done") parent.completedSubtaskCount += 1;
      if (isArchived !== isArchivedStatus(parent.status)) task.parentTaskTitle = parent.title;
    }
    const group = isArchived ? archived : active;
    group.push(task);
  }

  return {
    activeTasks: buildTaskHierarchy(active),
    archivedTasks: buildTaskHierarchy(archived),
    archivedCount: archived.length,
  };
}
