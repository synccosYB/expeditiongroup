/** Pure execution state transitions. Database workers must enforce these with conditional writes. */
export type ExecutionStatus = "pending" | "awaiting_approval" | "running" | "completed" | "failed" | "cancelled";

const transitions: Readonly<Record<ExecutionStatus, readonly ExecutionStatus[]>> = {
  pending: ["running", "awaiting_approval", "cancelled"],
  awaiting_approval: ["pending", "cancelled"],
  running: ["completed", "failed"],
  completed: [],
  failed: ["pending", "cancelled"],
  cancelled: [],
};

export function canTransitionExecution(from: ExecutionStatus, to: ExecutionStatus): boolean {
  return transitions[from]?.includes(to) ?? false;
}

export function initialExecutionStatus(requiresApproval: boolean): ExecutionStatus {
  return requiresApproval ? "awaiting_approval" : "pending";
}

export function retryDelaySeconds(attempt: number): number {
  if (!Number.isSafeInteger(attempt) || attempt < 1) throw new Error("Invalid attempt");
  return Math.min(3600, 15 * 2 ** Math.min(attempt - 1, 12));
}
