import type { Express, Request, Response } from "express";
import { z } from "zod";
import { db } from "./db";
import { isAuthenticated } from "./auth";
import { storage } from "./storage";
import {
  applyRetainer, BillingConflict, cancelRetainerRequest, createRetainerRequest, getClientBilling,
  recordRetainerReceipt, reverseRetainerApplication, saveRetainerSettings, voidRetainerReceipt,
} from "./client-retainer-service";

const id = (value: string) => z.coerce.number().int().min(1).max(2_147_483_647).parse(value);

export function registerClientRetainerRoutes(app: Express) {
  const staff = (handler: (req: Request, res: Response, actor: string) => Promise<unknown>) =>
    async (req: Request, res: Response) => {
      try {
        const actor = await storage.getUser(req.session.userId!);
        if (actor?.role !== "admin" && actor?.role !== "super_admin")
          return res.status(403).json({ message: "Forbidden" });
        await handler(req, res, actor.id);
      } catch (error) {
        if (error instanceof z.ZodError)
          return res.status(400).json({ message: error.issues[0]?.message ?? "Invalid input." });
        if (error instanceof BillingConflict)
          return res.status(error.status).json({ message: error.message });
        console.error("Client billing operation failed", error);
        return res.status(500).json({ message: "Unable to complete the client billing operation." });
      }
    };

  const projectPath = "/api/clients/:clientId/billing/projects/:projectId";
  const scope = (req: Request) => ({ clientId: id(req.params.clientId), projectId: id(req.params.projectId) });

  app.get("/api/clients/:clientId/billing", isAuthenticated, staff(async (req, res) => {
    res.json(await getClientBilling(db, id(req.params.clientId)));
  }));
  app.put(projectPath, isAuthenticated, staff(async (req, res, actor) => {
    res.json(await saveRetainerSettings(db, scope(req), req.body, actor));
  }));
  app.post(`${projectPath}/requests`, isAuthenticated, staff(async (req, res, actor) => {
    res.status(201).json(await createRetainerRequest(db, scope(req), req.body, actor));
  }));
  app.post(`${projectPath}/requests/:requestId/cancel`, isAuthenticated, staff(async (req, res, actor) => {
    await cancelRetainerRequest(db, scope(req), id(req.params.requestId), actor);
    res.sendStatus(204);
  }));
  app.post(`${projectPath}/requests/:requestId/receipts`, isAuthenticated, staff(async (req, res, actor) => {
    res.status(201).json(await recordRetainerReceipt(db, scope(req), id(req.params.requestId), req.body, actor));
  }));
  app.post(`${projectPath}/receipts/:paymentId/void`, isAuthenticated, staff(async (req, res, actor) => {
    await voidRetainerReceipt(db, scope(req), id(req.params.paymentId), actor);
    res.sendStatus(204);
  }));
  app.post(`${projectPath}/applications`, isAuthenticated, staff(async (req, res, actor) => {
    res.status(201).json(await applyRetainer(db, scope(req), req.body, actor));
  }));
  app.post(`${projectPath}/applications/:applicationId/reverse`, isAuthenticated, staff(async (req, res, actor) => {
    await reverseRetainerApplication(db, scope(req), id(req.params.applicationId), actor);
    res.sendStatus(204);
  }));
}
