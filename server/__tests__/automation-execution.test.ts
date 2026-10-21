import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionExecution, initialExecutionStatus, retryDelaySeconds } from "../../shared/automation-execution";

test("approval required actions do not begin pending execution", () => {
  assert.equal(initialExecutionStatus(true), "awaiting_approval");
  assert.equal(initialExecutionStatus(false), "pending");
  assert.equal(canTransitionExecution("awaiting_approval", "running"), false);
  assert.equal(canTransitionExecution("awaiting_approval", "pending"), true);
});
test("completed or cancelled work cannot be restarted", () => {
  assert.equal(canTransitionExecution("completed", "pending"), false);
  assert.equal(canTransitionExecution("cancelled", "running"), false);
  assert.equal(canTransitionExecution("running", "completed"), true);
});
test("retry delay is bounded and rejects invalid attempts", () => {
  assert.equal(retryDelaySeconds(1), 15);
  assert.equal(retryDelaySeconds(2), 30);
  assert.equal(retryDelaySeconds(100), 3600);
  assert.throws(() => retryDelaySeconds(0));
});
