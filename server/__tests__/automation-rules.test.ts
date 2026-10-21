import assert from "node:assert/strict";
import test from "node:test";
import { planAutomationActions, validateAutomationRule } from "../../shared/automation-rules";

const event = {
  id: "event-1", type: "task.completed" as const, entityId: "44",
  projectId: "12", actor: { kind: "user" as const, id: "3" },
  occurredAt: "2026-10-21T12:00:00.000Z", schemaVersion: 1 as const,
  changes: { status: "done" },
};
const rule = {
  id: "follow-up", version: 1, name: "Follow up", enabled: true,
  trigger: "task.completed" as const,
  conditions: [{ field: "changes.status" as const, operator: "equals" as const, value: "done" }],
  actions: [{ type: "create_task" as const, title: "Review work" }],
  requiresApproval: false,
};

test("rule matching is opt-in and deterministic", () => {
  assert.equal(validateAutomationRule(rule), true);
  assert.equal(planAutomationActions(event, [rule]).length, 1);
  assert.equal(planAutomationActions(event, [rule, rule]).length, 1);
  assert.equal(planAutomationActions(event, [{ ...rule, enabled: false }]).length, 0);
  assert.equal(planAutomationActions({ ...event, type: "project.created" }, [rule]).length, 0);
});
test("rejects unrecognized actions", () => {
  assert.equal(validateAutomationRule({ ...rule, actions: [{ type: "unsupported" }] }), false);
});

test("reminder addresses accept valid emails and reject whitespace", () => {
  const reminder = (recipientEmail: string) => ({
    ...rule, actions: [{ type: "schedule_reminder", title: "Follow up", recipientEmail, delayMinutes: 60 }],
  });
  assert.equal(validateAutomationRule(reminder("billing@example.com")), true);
  assert.equal(validateAutomationRule(reminder("billing @example.com")), false);
  assert.equal(validateAutomationRule(reminder("billing@examplecom")), false);
});
