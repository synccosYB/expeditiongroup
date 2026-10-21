import { automationEventTypes, type AutomationEvent, type AutomationEventType } from "./automation-events";

/** Declarative, side-effect-free rules. No arbitrary JavaScript or HTTP actions. */
export type AutomationCondition =
  | { field: "projectId" | "clientId" | "actor.kind"; operator: "equals"; value: string }
  | { field: "changes.status" | "changes.previousStatus"; operator: "equals"; value: string };

export type AutomationAction =
  | { type: "create_task"; title: string; assigneeId?: string }
  | { type: "create_document_request"; title: string }
  | { type: "create_checklist"; title: string; items: string[] }
  | { type: "schedule_reminder"; title: string; recipientEmail: string; delayMinutes: number }
  | { type: "notify_internal"; message: string };

export interface AutomationRule {
  id: string;
  version: number;
  name: string;
  enabled: boolean;
  trigger: AutomationEventType;
  conditions: readonly AutomationCondition[];
  actions: readonly AutomationAction[];
  requiresApproval: boolean;
}

export interface AutomationMatch {
  ruleId: string;
  ruleVersion: number;
  eventId: string;
  /** Stable identity for deduplicating a rule version's handling of an event. */
  executionKey: string;
  actions: readonly AutomationAction[];
  requiresApproval: boolean;
}

const allowedEvents: ReadonlySet<string> = new Set(automationEventTypes);
const allowedFields = new Set(["projectId", "clientId", "actor.kind", "changes.status", "changes.previousStatus"]);
const allowedActions = new Set(["create_task", "create_document_request", "create_checklist", "schedule_reminder", "notify_internal"]);

export function validateAutomationRule(value: unknown): value is AutomationRule {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id.trim() ||
      typeof r.name !== "string" || !r.name.trim() ||
      !Number.isSafeInteger(r.version) || (r.version as number) < 1 ||
      typeof r.enabled !== "boolean" || !allowedEvents.has(String(r.trigger)) ||
      typeof r.requiresApproval !== "boolean" ||
      !Array.isArray(r.conditions) || !Array.isArray(r.actions) ||
      r.actions.length === 0 || r.actions.length > 20 || r.conditions.length > 20) return false;
  for (const condition of r.conditions) {
    if (!condition || typeof condition !== "object" ||
        !allowedFields.has(condition.field) || condition.operator !== "equals" ||
        typeof condition.value !== "string") return false;
  }
  for (const action of r.actions) {
    if (!action || typeof action !== "object" || !allowedActions.has(action.type)) return false;
    if (action.type === "create_task" || action.type === "create_document_request" || action.type === "create_checklist" || action.type === "schedule_reminder") {
      if (typeof action.title !== "string" || !action.title.trim()) return false;
    }
    if (action.type === "notify_internal" && (typeof action.message !== "string" || !action.message.trim())) return false;
    if (action.type === "create_checklist" && (!Array.isArray(action.items) || action.items.length > 100 || !action.items.every((item: unknown) => typeof item === "string" && item.trim()))) return false;
    if (action.type === "schedule_reminder" && (typeof action.recipientEmail !== "string" || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(action.recipientEmail) || !Number.isSafeInteger(action.delayMinutes) || action.delayMinutes < 1 || action.delayMinutes > 525600)) return false;
    if (action.assigneeId !== undefined && typeof action.assigneeId !== "string") return false;
  }
  return true;
}

export function matchesAutomationRule(rule: AutomationRule, event: AutomationEvent): boolean {
  if (!rule.enabled || rule.trigger !== event.type) return false;
  return rule.conditions.every((condition) => {
    const actual = condition.field === "projectId" ? event.projectId
      : condition.field === "clientId" ? event.clientId
      : condition.field === "actor.kind" ? event.actor.kind
      : condition.field === "changes.status" ? event.changes?.status
      : event.changes?.previousStatus;
    return typeof actual === "string" && actual === condition.value;
  });
}

/** Only returns plans; it never mutates records or dispatches notifications. */
export function planAutomationActions(event: AutomationEvent, rules: readonly AutomationRule[]): AutomationMatch[] {
  const matches: AutomationMatch[] = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    if (!validateAutomationRule(rule) || !matchesAutomationRule(rule, event)) continue;
    const executionKey = JSON.stringify([event.id, rule.id, rule.version]);
    if (seen.has(executionKey)) continue;
    seen.add(executionKey);
    matches.push({
      ruleId: rule.id,
      ruleVersion: rule.version,
      eventId: event.id,
      executionKey,
      actions: rule.actions,
      requiresApproval: rule.requiresApproval,
    });
  }
  return matches;
}
