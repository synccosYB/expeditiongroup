/**
 * Expedition Group automation event contract (M01).
 *
 * This module is deliberately side-effect-free. Existing API writes must not
 * publish events until the transactional outbox and worker are implemented.
 * Event identifiers refer to existing records, never duplicate business data.
 */
export const automationEventTypes = [
  "client.created",
  "intake.converted",
  "project.created",
  "project.status_changed",
  "task.created",
  "task.completed",
  "document.uploaded",
  "document.reviewed",
  "document_request.completed",
  "milestone.completed",
  "proposal.accepted",
  "invoice.status_changed",
  "bill.status_changed",
  "payment.recorded",
] as const;

export type AutomationEventType = (typeof automationEventTypes)[number];
export type AutomationActor = { kind: "user"; id: string } | { kind: "system"; id: string };

export interface AutomationEvent {
  /** Unique event ID; also used as a durable deduplication key. */
  id: string;
  type: AutomationEventType;
  /** ID of the existing entity that caused this event. */
  entityId: string;
  /** Optional project/client context for filtering; never authoritative ownership. */
  projectId?: string;
  clientId?: string;
  actor: AutomationActor;
  /** ISO-8601 timestamp from the server. */
  occurredAt: string;
  /** Version of the event payload schema, not the business record. */
  schemaVersion: 1;
  /** Minimal non-sensitive change data; no credentials or document contents. */
  changes?: Readonly<Record<string, unknown>>;
}

const eventTypes: ReadonlySet<string> = new Set(automationEventTypes);

export function isAutomationEventType(value: unknown): value is AutomationEventType {
  return typeof value === "string" && eventTypes.has(value);
}

/**
 * Validates an event envelope before storage. This does not authorize an action:
 * permission checks must be performed again by the future execution worker.
 */
export function isAutomationEvent(value: unknown): value is AutomationEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const e = value as Record<string, unknown>;
  const actor = e.actor;
  return (
    typeof e.id === "string" && e.id.trim().length > 0 &&
    isAutomationEventType(e.type) &&
    typeof e.entityId === "string" && e.entityId.trim().length > 0 &&
    typeof e.occurredAt === "string" &&
    !Number.isNaN(Date.parse(e.occurredAt)) &&
    e.schemaVersion === 1 &&
    (e.projectId === undefined || typeof e.projectId === "string") &&
    (e.clientId === undefined || typeof e.clientId === "string") &&
    (e.changes === undefined ||
      (typeof e.changes === "object" && e.changes !== null && !Array.isArray(e.changes))) &&
    typeof actor === "object" && actor !== null &&
    !Array.isArray(actor) &&
    ((actor as Record<string, unknown>).kind === "user" ||
      (actor as Record<string, unknown>).kind === "system") &&
    typeof (actor as Record<string, unknown>).id === "string" &&
    ((actor as Record<string, unknown>).id as string).trim().length > 0
  );
}
