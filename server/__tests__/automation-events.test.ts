import assert from "node:assert/strict";
import test from "node:test";
import { automationEventTypes, isAutomationEvent, isAutomationEventType } from "../../shared/automation-events";

const valid = {
  id: "evt-1",
  type: "task.completed",
  entityId: "123",
  actor: { kind: "user", id: "u1" },
  occurredAt: "2026-10-21T12:00:00.000Z",
  schemaVersion: 1,
};

test("all registered automation event types are accepted", () => {
  for (const type of automationEventTypes) assert.equal(isAutomationEventType(type), true);
  assert.equal(isAutomationEventType("check.printed"), false);
});

test("valid business event envelope is accepted", () => {
  assert.equal(isAutomationEvent(valid), true);
});

test("invalid and incomplete envelopes are rejected", () => {
  for (const candidate of [
    null,
    {},
    { ...valid, id: "" },
    { ...valid, type: "unknown" },
    { ...valid, entityId: "" },
    { ...valid, schemaVersion: 2 },
    { ...valid, occurredAt: "not-a-date" },
    { ...valid, actor: { kind: "anonymous", id: "u1" } },
    { ...valid, actor: { kind: "user", id: "" } },
    { ...valid, changes: [] },
  ]) assert.equal(isAutomationEvent(candidate), false);
});
