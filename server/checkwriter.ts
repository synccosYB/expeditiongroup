import type { Express } from "express";
import { z } from "zod";
import { eq, isNotNull, or, desc } from "drizzle-orm";
import { db, storage } from "./storage";
import { isAuthenticated } from "./auth";
import { bankTransactions, billPayments, bills } from "@shared/schema";
import { checkRequestSchema, validateCheckAttachment } from "@shared/checkwriter";
import { CheckError, issueCheck, voidCheck } from "./checkwriter-service";
import { objectStorageService, ObjectNotFoundError } from "./objectStorage";

export function registerCheckwriterRoutes(app: Express) {
  const admin = async (req: any, res: any, next: any) => {
    try { const user = await storage.getUser(req.session.userId); if (user?.role !== "admin" && user?.role !== "super_admin") return res.status(403).json({ message: "Forbidden" }); next(); }
    catch (e) { next(e); }
  };
  const fail = (res: any, e: unknown) => {
    if (e instanceof z.ZodError || e instanceof CheckError) return res.status(400).json({ message: e instanceof z.ZodError ? e.issues.map(i => i.message).join("; ") : e.message });
    if (e instanceof ObjectNotFoundError) return res.status(404).json({ message: "Attached bill was not found" });
    console.error("Checkwriter operation failed", e); return res.status(500).json({ message: "Unable to complete check operation" });
  };
  app.post("/api/checks/upload-url", isAuthenticated, admin, async (req: any, res) => {
    try {
      const { name, contentType } = z.object({ name: z.string().trim().min(1).max(255), contentType: z.enum(["application/pdf", "image/png", "image/jpeg"]) }).parse(req.body);
      const url = await objectStorageService.getObjectEntityUploadURL("check-bills");
      const path = objectStorageService.normalizeObjectEntityPath(url);
      req.session.checkUploads = [...(req.session.checkUploads || []).slice(-19), { path, name, contentType }];
      res.json({ url, path, method: "PUT" });
    } catch (e) { fail(res, e); }
  });
  const issue = async (req: any, res: any) => {
    try {
      const input = checkRequestSchema.parse({ ...req.body, ...(req.params.id ? { billId: Number(req.params.id) } : {}) });
      if (input.attachment) {
        const reservation = (req.session.checkUploads || []).find((u: any) => u.path === input.attachment!.path && u.name === input.attachment!.name);
        if (!reservation) throw new CheckError("Upload the attached bill from this check screen first");
        const file = await objectStorageService.getObjectEntityFile(input.attachment.path);
        const [metadata] = await file.getMetadata();
        try { validateCheckAttachment(metadata.contentType, Number(metadata.size), reservation.contentType); } catch (e) { throw new CheckError((e as Error).message); }
      }
      const { transaction, payment } = await issueCheck(db, input, req.session.userId);
      res.status(201).json(req.params.id ? payment : transaction);
    } catch (e) { fail(res, e); }
  };
  app.post("/api/checks", isAuthenticated, admin, issue);
  app.post("/api/bills/:id/checks", isAuthenticated, admin, issue);
  app.get("/api/checks", isAuthenticated, admin, async (_req, res) => {
    try {
      const rows = await db.select({ transaction: bankTransactions, payment: billPayments, billDocument: bills.documentUrl }).from(bankTransactions)
        .leftJoin(billPayments, eq(billPayments.bankTransactionId, bankTransactions.id)).leftJoin(bills, eq(bills.id, billPayments.billId))
        .where(or(isNotNull(bankTransactions.checkDetails), isNotNull(billPayments.checkDetails))).orderBy(desc(bankTransactions.id));
      res.json(rows.map(({ transaction, payment, billDocument }) => ({ id: transaction.id, bankAccountId: transaction.bankAccountId, amount: transaction.amount, checkDetails: transaction.checkDetails || payment?.checkDetails, linkedBillId: payment?.billId || null, hasAttachment: !!((transaction.checkDetails || payment?.checkDetails)?.attachment || billDocument) })));
    } catch (e) { fail(res, e); }
  });
  app.get("/api/checks/:id/attachment", isAuthenticated, admin, async (req: any, res) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const [transaction] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, id));
      const [payment] = await db.select().from(billPayments).where(eq(billPayments.bankTransactionId, id));
      const details = transaction?.checkDetails || payment?.checkDetails;
      let path = details?.attachment?.path;
      if (!path && payment) { const bill = await storage.getBill(payment.billId); path = bill?.documentUrl || undefined; }
      if (!details || !path?.startsWith("/objects/")) return res.status(404).json({ message: "No bill document attached" });
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "sandbox");
      await objectStorageService.downloadObject(await objectStorageService.getObjectEntityFile(path), res, { inline: true });
    } catch (e) { fail(res, e); }
  });
  const voidHandler = async (req: any, res: any) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const payment = req.path.startsWith("/api/bill-payments/") ? await storage.getBillPayment(id) : undefined;
      const transactionId = payment ? payment.bankTransactionId : id;
      if (!transactionId || (req.path.startsWith("/api/bill-payments/") && !payment?.checkDetails)) throw new CheckError("Printed check not found");
      const transaction = await storage.getBankTransaction(transactionId);
      if (!transaction) throw new CheckError("Printed check not found");
      const result = await voidCheck(db, transactionId, transaction.bankAccountId, req.session.userId);
      res.json(payment ? await storage.getBillPayment(payment.id) : result);
    } catch (e) { fail(res, e); }
  };
  app.post("/api/checks/:id/void", isAuthenticated, admin, voidHandler);
  app.post("/api/bill-payments/:id/void-check", isAuthenticated, admin, voidHandler);
}
