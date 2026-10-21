import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
  automationActionReceipts, automationExecutions, automationOutbox,
  automationProjectSettings, automationRules, checklistInstances, taskReminders,
  documentRequests, projects, tasks,
} from "@shared/schema";
import { isAutomationEvent, type AutomationEvent } from "@shared/automation-events";
import { planAutomationActions, validateAutomationRule, type AutomationAction } from "@shared/automation-rules";

/**
 * Explicitly invoked processing; never started at server startup.
 * Disabled unless AUTOMATION_ENGINE_ENABLED=true. No external email,
 * money movement, or invoice actions are permitted.
 */
export async function planPendingAutomationEvents(limit = 25) {
  if (process.env.AUTOMATION_ENGINE_ENABLED !== "true") return 0;
  const events = await db.select().from(automationOutbox)
    .where(eq(automationOutbox.status, "pending"))
    .orderBy(automationOutbox.createdAt).limit(Math.min(limit, 100));
  let processed = 0;
  for (const row of events) {
    await db.transaction(async tx => {
      const [locked] = await tx.select().from(automationOutbox)
        .where(and(eq(automationOutbox.id, row.id), eq(automationOutbox.status, "pending")))
        .for("update");
      if (!locked) return;
      const event: AutomationEvent = {
        id: locked.id, type: locked.eventType as AutomationEvent["type"],
        entityId: locked.entityId, projectId: locked.projectId ?? undefined,
        clientId: locked.clientId ?? undefined,
        actor: { kind: locked.actorKind as "user" | "system", id: locked.actorId },
        occurredAt: locked.occurredAt.toISOString(), schemaVersion: 1,
        changes: locked.changes ?? undefined,
      };
      if (!isAutomationEvent(event)) throw new Error("Malformed persisted automation event");
      const [settings] = locked.projectId
        ? await tx.select().from(automationProjectSettings)
          .where(eq(automationProjectSettings.projectId, Number(locked.projectId)))
        : [];
      if (settings?.enabled !== false) {
        const rows = await tx.select().from(automationRules)
          .where(and(eq(automationRules.enabled, true), eq(automationRules.triggerType, event.type)));
        const rules = rows.map(r => ({
          id: r.id, version: r.version, name: r.name, enabled: r.enabled,
          trigger: r.triggerType as AutomationEvent["type"], conditions: r.conditions,
          actions: r.actions, requiresApproval: r.requiresApproval,
        })).filter(validateAutomationRule);
        for (const match of planAutomationActions(event, rules)) {
          await tx.insert(automationExecutions).values({
            id: randomUUID(), eventId: event.id, ruleId: match.ruleId,
            ruleVersion: match.ruleVersion,
            status: match.requiresApproval ? "awaiting_approval" : "pending",
            actionPlan: [...match.actions],
          }).onConflictDoNothing();
        }
      }
      await tx.update(automationOutbox).set({ status: "completed", processedAt: new Date() })
        .where(eq(automationOutbox.id, row.id));
      processed++;
    });
  }
  return processed;
}

export async function executePendingAutomationActions(limit = 10) {
  if (process.env.AUTOMATION_ENGINE_ENABLED !== "true") return 0;
  const candidates = await db.select().from(automationExecutions)
    .where(and(eq(automationExecutions.status, "pending"),
      sql`${automationExecutions.nextAttemptAt} <= now()`))
    .orderBy(automationExecutions.createdAt).limit(Math.min(limit, 50));
  let completed = 0;
  for (const candidate of candidates) {
    await db.transaction(async tx => {
      const [execution] = await tx.select().from(automationExecutions)
        .where(and(eq(automationExecutions.id, candidate.id), eq(automationExecutions.status, "pending")))
        .for("update");
      if (!execution) return;
      const [event] = await tx.select().from(automationOutbox)
        .where(eq(automationOutbox.id, execution.eventId));
      const [rule] = await tx.select().from(automationRules)
        .where(and(eq(automationRules.id, execution.ruleId),
          eq(automationRules.version, execution.ruleVersion)));
      if (!event || !rule || !rule.enabled) {
        await tx.update(automationExecutions).set({ status: "cancelled" })
          .where(eq(automationExecutions.id, execution.id));
        return;
      }
      const projectId = Number(event.projectId);
      if (!Number.isSafeInteger(projectId) || projectId <= 0) {
        await tx.update(automationExecutions).set({ status: "failed", lastError: "Project context required" })
          .where(eq(automationExecutions.id, execution.id));
        return;
      }
      const [project] = await tx.select().from(projects).where(eq(projects.id, projectId));
      const [settings] = await tx.select().from(automationProjectSettings)
        .where(eq(automationProjectSettings.projectId, projectId));
      if (!project || settings?.enabled === false) {
        await tx.update(automationExecutions).set({ status: "cancelled" })
          .where(eq(automationExecutions.id, execution.id));
        return;
      }
      if (!validateAutomationRule({
        id: rule.id, version: rule.version, name: rule.name, enabled: rule.enabled,
        trigger: rule.triggerType, conditions: rule.conditions,
        actions: execution.actionPlan, requiresApproval: rule.requiresApproval,
      })) throw new Error("Invalid execution plan");
      const actions = execution.actionPlan as AutomationAction[];
      for (let i = 0; i < actions.length; i++) {
        const [receipt] = await tx.select().from(automationActionReceipts)
          .where(and(eq(automationActionReceipts.executionId, execution.id),
            eq(automationActionReceipts.actionIndex, i)));
        if (receipt) continue;
        const action = actions[i];
        let entityType: string;
        let entityId: string;
        if (action.type === "create_task") {
          const [created] = await tx.insert(tasks).values({
            projectId, title: action.title, assigneeId: action.assigneeId,
          }).returning({ id: tasks.id });
          entityType = "task"; entityId = String(created.id);
        } else if (action.type === "create_document_request") {
          const [created] = await tx.insert(documentRequests).values({
            projectId, clientId: project.clientId, documentType: action.title.slice(0, 100),
            description: action.title,
          }).returning({ id: documentRequests.id });
          entityType = "document_request"; entityId = String(created.id);
        } else if (action.type === "create_checklist") {
          const [created] = await tx.insert(checklistInstances).values({
            projectId, name: action.title,
            items: action.items.map((item, index) => ({ id: index + 1, text: item, completed: false })),
          }).returning({ id: checklistInstances.id });
          entityType = "checklist"; entityId = String(created.id);
        } else if (action.type === "schedule_reminder") {
          const [createdTask] = await tx.insert(tasks).values({
            projectId, title: action.title, type: "other",
          }).returning({ id: tasks.id });
          const [created] = await tx.insert(taskReminders).values({
            taskId: createdTask.id, channel: "email",
            recipientEmail: action.recipientEmail,
            scheduledAt: new Date(Date.now() + action.delayMinutes * 60_000),
            message: action.title, status: "pending",
          }).returning({ id: taskReminders.id });
          entityType = "task_reminder"; entityId = String(created.id);
        } else if (action.type === "notify_internal") {
          // Never silently pretend an external message was delivered.
          throw new Error("Internal notification delivery is not configured");
        } else {
          throw new Error("Unsupported automation action");
        }
        await tx.insert(automationActionReceipts).values({
          executionId: execution.id, actionIndex: i,
          resultEntityType: entityType, resultEntityId: entityId,
        });
      }
      await tx.update(automationExecutions).set({
        status: "completed", completedAt: new Date(), lastError: null,
      }).where(eq(automationExecutions.id, execution.id));
      completed++;
    });
  }
  return completed;
}
