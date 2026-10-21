import type { Express } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { automationExecutions, automationProjectSettings, automationRules, automationNotifications, automationAudit } from "@shared/schema";
import { validateAutomationRule } from "@shared/automation-rules";
import { planPendingAutomationEvents, executePendingAutomationActions } from "./automation-worker";
import { isAuthenticated } from "./auth";

export function registerAutomationRoutes(app: Express) {
  const requireAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = req.session?.userId;
      if (typeof userId !== "string" || !userId) return res.sendStatus(401);
      const { storage } = await import("./storage");
      const user = await storage.getUser(userId);
      if (!user || !["admin", "super_admin"].includes(user.role)) return res.sendStatus(403);
      next();
    } catch {
      res.sendStatus(500);
    }
  };

  app.get("/api/automation/audit", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      res.json(await db.select().from(automationAudit).orderBy(desc(automationAudit.createdAt)).limit(200));
    } catch { res.status(500).json({ message: "Unable to load audit trail" }); }
  });

  app.get("/api/automation/notifications", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      res.json(await db.select().from(automationNotifications)
        .orderBy(desc(automationNotifications.createdAt)).limit(100));
    } catch { res.status(500).json({ message: "Unable to load notifications" }); }
  });

  app.patch("/api/automation/notifications/:id/read", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [notification] = await db.update(automationNotifications).set({ isRead: true })
        .where(eq(automationNotifications.id, req.params.id)).returning();
      if (!notification) return res.sendStatus(404);
      res.json(notification);
    } catch { res.status(500).json({ message: "Unable to mark notification read" }); }
  });

  app.get("/api/automation/rules", isAuthenticated, requireAdmin, async (_req, res) => {
    try { res.json(await db.select().from(automationRules).orderBy(desc(automationRules.createdAt))); }
    catch { res.status(500).json({ message: "Unable to load rules" }); }
  });

  app.post("/api/automation/rules", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const candidate = { ...req.body, enabled: false };
      if (!validateAutomationRule(candidate)) return res.status(400).json({ message: "Invalid rule" });
      const [created] = await db.insert(automationRules).values({
        id: candidate.id, version: candidate.version, name: candidate.name,
        enabled: false, triggerType: candidate.trigger,
        conditions: [...candidate.conditions], actions: [...candidate.actions],
        requiresApproval: candidate.requiresApproval,
      }).returning();
      await db.insert(automationAudit).values({ actorId: req.session.userId, action: "rule.created", targetType: "rule", targetId: created.id, details: { version: created.version } });
      res.status(201).json(created);
    } catch { res.status(409).json({ message: "Rule version already exists or is invalid" }); }
  });

  app.patch("/api/automation/rules/:id/:version", isAuthenticated, requireAdmin, async (req: any, res) => {
    const version = Number(req.params.version);
    if (!Number.isSafeInteger(version) || version < 1 || typeof req.body?.enabled !== "boolean")
      return res.status(400).json({ message: "Invalid rule state" });
    try {
      const [updated] = await db.update(automationRules)
        .set({ enabled: req.body.enabled })
        .where(and(eq(automationRules.id, req.params.id), eq(automationRules.version, version)))
        .returning();
      if (!updated) return res.sendStatus(404);
      await db.insert(automationAudit).values({ actorId: req.session.userId, action: updated.enabled ? "rule.enabled" : "rule.disabled", targetType: "rule", targetId: updated.id, details: { version: updated.version } });
      res.json(updated);
    } catch { res.status(500).json({ message: "Unable to update rule" }); }
  });

  app.get("/api/automation/projects/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    const projectId = Number(req.params.id);
    if (!Number.isSafeInteger(projectId) || projectId <= 0) return res.sendStatus(400);
    try {
      const [settings] = await db.select().from(automationProjectSettings)
        .where(eq(automationProjectSettings.projectId, projectId));
      res.json(settings ?? { projectId, enabled: true });
    } catch { res.status(500).json({ message: "Unable to load project settings" }); }
  });

  app.get("/api/automation/executions", isAuthenticated, requireAdmin, async (_req, res) => {
    try { res.json(await db.select().from(automationExecutions).orderBy(desc(automationExecutions.createdAt)).limit(100)); }
    catch { res.status(500).json({ message: "Unable to load executions" }); }
  });

  app.patch("/api/automation/projects/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    const projectId = Number(req.params.id);
    if (!Number.isSafeInteger(projectId) || projectId <= 0 || typeof req.body?.enabled !== "boolean")
      return res.status(400).json({ message: "Invalid project settings" });
    try {
      const [setting] = await db.insert(automationProjectSettings).values({
        projectId, enabled: req.body.enabled, updatedBy: req.user?.claims?.sub ?? req.user?.id ?? req.session?.userId,
      }).onConflictDoUpdate({
        target: automationProjectSettings.projectId,
        set: { enabled: req.body.enabled, updatedBy: req.session.userId, updatedAt: new Date() },
      }).returning();
      await db.insert(automationAudit).values({ actorId: req.session.userId, action: setting.enabled ? "project.enabled" : "project.disabled", targetType: "project", targetId: String(projectId) });
      res.json(setting);
    } catch { res.status(500).json({ message: "Unable to update project settings" }); }
  });

  app.post("/api/automation/process", isAuthenticated, requireAdmin, async (_req, res) => {
    if (process.env.AUTOMATION_ENGINE_ENABLED !== "true")
      return res.status(409).json({ message: "Automation execution is disabled" });
    try {
      const planned = await planPendingAutomationEvents();
      const executed = await executePendingAutomationActions();
      res.json({ planned, executed });
    } catch (error) {
      console.error("Automation processing failed", error);
      res.status(500).json({ message: "Automation processing failed; transaction rolled back" });
    }
  });

  app.post("/api/automation/executions/:id/cancel", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [cancelled] = await db.transaction(async (tx) => {
        const rows = await tx.update(automationExecutions)
          .set({ status: "cancelled" })
          .where(and(eq(automationExecutions.id, req.params.id), eq(automationExecutions.status, "awaiting_approval")))
          .returning();
        if (rows[0]) await tx.insert(automationAudit).values({
          actorId: req.session.userId, action: "execution.cancelled",
          targetType: "execution", targetId: rows[0].id,
        });
        return rows;
      });
      if (!cancelled) return res.status(409).json({ message: "Execution cannot be cancelled in its current state" });
      res.json(cancelled);
    } catch { res.status(500).json({ message: "Unable to cancel execution" }); }
  });

  app.post("/api/automation/executions/:id/approve", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [updated] = await db.transaction(async (tx) => {
        const rows = await tx.update(automationExecutions).set({
          status: "pending", approvedBy: req.session.userId, approvedAt: new Date(),
        }).where(and(eq(automationExecutions.id, req.params.id),
          eq(automationExecutions.status, "awaiting_approval"))).returning();
        if (rows[0]) await tx.insert(automationAudit).values({ actorId: req.session.userId, action: "execution.approved", targetType: "execution", targetId: rows[0].id });
        return rows;
      });
      if (!updated) return res.sendStatus(404);
      res.json(updated);
    } catch { res.status(500).json({ message: "Unable to approve execution" }); }
  });
}
