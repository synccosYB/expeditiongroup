import { randomUUID } from "node:crypto";
import { db } from "./db";
import { projects, tasks, automationOutbox, type InsertProject, type InsertTask } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Event producers for the two initial application write paths.
 * All inserts occur in the same database transaction as the business mutation.
 * This code never executes an automation action or sends an external message.
 */
export async function createProjectWithEvent(input: InsertProject, actorId: string) {
  return db.transaction(async (tx) => {
    const [project] = await tx.insert(projects).values(input).returning();
    await tx.insert(automationOutbox).values({
      id: randomUUID(),
      eventType: "project.created",
      entityId: String(project.id),
      projectId: String(project.id),
      clientId: String(project.clientId),
      actorKind: "user",
      actorId,
      occurredAt: new Date(),
      schemaVersion: 1,
    });
    return project;
  });
}

/**
 * A task.completed event is emitted only when the persisted status transitions
 * from something other than done to done. Row locking prevents duplicate events
 * from concurrent completion requests. Non-completion updates are unchanged.
 */
export async function updateTaskWithCompletionEvent(
  taskId: number,
  input: Partial<InsertTask>,
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(tasks)
      .where(eq(tasks.id, taskId)).for("update");
    if (!before) return undefined;
    const updateData: Record<string, unknown> = { ...input, updatedAt: new Date() };
    if (input.status === "done" && !input.completedAt) {
      updateData.completedAt = new Date();
    }
    const [updated] = await tx.update(tasks)
      .set(updateData)
      .where(eq(tasks.id, taskId))
      .returning();
    if (before.status !== "done" && updated.status === "done") {
      await tx.insert(automationOutbox).values({
        id: randomUUID(),
        eventType: "task.completed",
        entityId: String(updated.id),
        projectId: String(updated.projectId),
        actorKind: "user",
        actorId,
        occurredAt: new Date(),
        schemaVersion: 1,
        changes: { previousStatus: before.status, status: updated.status },
      });
    }
    return updated;
  });
}
