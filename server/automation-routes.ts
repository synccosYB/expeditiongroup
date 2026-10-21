import type { Express } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { automationExecutions, automationProjectSettings, automationRules } from "@shared/schema";
import { validateAutomationRule } from "@shared/automation-rules";
import { planPendingAutomationEvents, executePendingAutomationActions } from "./automation-worker";
import { isAuthenticated } from "./auth";

export function registerAutomationRoutes(app: Express) {
  const requireAdmin = async (req: any, res: any, next: any) => {
    if (req.user?.role === "admin" || req.user?.role === "super_admin") return next();
    // Auth middleware in this app uses sessions; never trust a client-supplied role.
    const { storage } = await import("./storage");
    const user = req.session?.userId ? await storage.getUser(req.session.userId) : null;
    if (!user || !["admin", "super_admin"].includes(user.role)) return res.sendStatus(403);
    next();
  };

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
      res.status(201).json(created);
    } catch { res.status(409).json({ message: "Rule version already exists or is invalid" }); }
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
        projectId, enabled: req.body.enabled, updatedBy: req.session.userId,
      }).onConflictDoUpdate({
        target: automationProjectSettings.projectId,
        set: { enabled: req.body.enabled, updatedBy: req.session.userId, updatedAt: new Date() },
      }).returning();
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

  app.post("/api/automation/executions/:id/approve", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [updated] = await db.update(automationExecutions).set({
        status: "pending", approvedBy: req.session.userId, approvedAt: new Date(),
      }).where(and(eq(automationExecutions.id, req.params.id),
        eq(automationExecutions.status, "awaiting_approval"))).returning();
      if (!updated) return res.sendStatus(404);
      res.json(updated);
    } catch { res.status(500).json({ message: "Unable to approve execution" }); }
  });
}
