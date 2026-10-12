import type { Express } from "express";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db, storage } from "./storage";
import { isAuthenticated } from "./auth";
import { bankAccounts, bankTransactions, billPayments, bills, vendors } from "@shared/schema";
import { validateCheckPayment, moneyToCents, type CheckDetails } from "@shared/checkwriter";

const requestSchema = z.object({
  bankAccountId: z.number().int().positive(),
  amount: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Invalid check date"),
  number: z.string().regex(/^[1-9]\d{0,8}$/),
  memo: z.string().max(150).default(""),
});
class CheckError extends Error {}

export function registerCheckwriterRoutes(app: Express) {
  const admin = async (req: any, res: any, next: any) => {
    try {
      const user = await storage.getUser(req.session.userId);
      if (user?.role !== "admin" && user?.role !== "super_admin") return res.status(403).json({ message: "Forbidden" });
      next();
    } catch (error) { next(error); }
  };
  app.post("/api/bills/:id/checks", isAuthenticated, admin, async (req: any, res) => {
    try {
      const input = requestSchema.parse(req.body);
      const payment = await db.transaction(async tx => {
        // Serialize check numbering and payments before inspecting balances.
        const [account] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, input.bankAccountId)).for("update");
        if (!account || !account.isActive || account.accountType !== "checking") throw new CheckError("Select an active checking account");
        if (!account.checkCompanyName?.trim() || !account.checkCompanyAddress?.trim()) throw new CheckError("Set the company name and address in Bank Accounts first");
        if (!/^\d{9}$/.test(account.routingNumber || "") || !/^\d{5,17}$/.test(account.accountNumber || "")) throw new CheckError("Set the full account number and nine-digit routing number in Bank Accounts first");
        const [bill] = await tx.select().from(bills).where(eq(bills.id, Number(req.params.id))).for("update");
        if (!bill || bill.status === "void" || bill.status === "draft") throw new CheckError("Select an open vendor bill");
        let cents: number;
        try { cents = validateCheckPayment(input.amount, bill.total, bill.amountPaid || "0"); } catch (e) { throw new CheckError((e as Error).message); }
        const existing = await tx.select({ id: bankTransactions.id }).from(bankTransactions).where(and(eq(bankTransactions.bankAccountId, account.id), eq(bankTransactions.checkNumber, input.number)));
        if (existing.length) throw new CheckError("This check number has already been used for this bank account");
        const [vendor] = await tx.select().from(vendors).where(eq(vendors.id, bill.vendorId));
        if (!vendor) throw new CheckError("Vendor not found");
        const amount = (cents / 100).toFixed(2);
        const details: CheckDetails = { number: input.number, date: input.date, amount, payee: vendor.name, payeeAddress: vendor.address || "", companyName: account.checkCompanyName, companyAddress: account.checkCompanyAddress, bankName: account.bankName || "", billNumber: bill.billNumber || String(bill.id), memo: input.memo, status: "issued", issuedBy: req.session.userId };
        const [transaction] = await tx.insert(bankTransactions).values({ bankAccountId: account.id, transactionDate: new Date(input.date + "T12:00:00"), transactionType: "check", payee: vendor.name, vendorId: vendor.id, description: `Check payment - ${details.billNumber}`, reference: input.number, checkNumber: input.number, amount, isCleared: false, isReconciled: false }).returning();
        const [payment] = await tx.insert(billPayments).values({ billId: bill.id, bankAccountId: account.id, bankTransactionId: transaction.id, paymentDate: transaction.transactionDate, amount, paymentMethod: "check", reference: input.number, checkDetails: details }).returning();
        const paid = moneyToCents(bill.amountPaid || "0") + cents;
        const due = moneyToCents(bill.total) - paid;
        await tx.update(bills).set({ amountPaid: (paid / 100).toFixed(2), amountDue: (due / 100).toFixed(2), status: due === 0 ? "paid" : "partial" }).where(eq(bills.id, bill.id));
        await tx.update(bankAccounts).set({ nextCheckNumber: Math.max(account.nextCheckNumber || 1, Number(input.number) + 1), currentBalance: sql`(coalesce(nullif(${bankAccounts.currentBalance}, ''), '0')::numeric - ${amount}::numeric)::text` }).where(eq(bankAccounts.id, account.id));
        return payment;
      });
      res.status(201).json(payment);
    } catch (e) {
      if (e instanceof z.ZodError || e instanceof CheckError) return res.status(400).json({ message: e.message });
      console.error("Check issuance failed", e);
      res.status(500).json({ message: "Unable to issue check" });
    }
  });
  app.post("/api/bill-payments/:id/void-check", isAuthenticated, admin, async (req: any, res) => {
    try {
      const payment = await db.transaction(async tx => {
        const initial = await storage.getBillPayment(Number(req.params.id));
        if (!initial?.checkDetails) throw new CheckError("Printed check not found");
        // Use the same lock order as issuance.
        await tx.select().from(bankAccounts).where(eq(bankAccounts.id, initial.bankAccountId)).for("update");
        const [bill] = await tx.select().from(bills).where(eq(bills.id, initial.billId)).for("update");
        const [current] = await tx.select().from(billPayments).where(eq(billPayments.id, initial.id)).for("update");
        if (!current?.checkDetails || !bill || !current.bankTransactionId) throw new CheckError("Check no longer exists");
        if (current.checkDetails.status === "void") return current;
        const [transaction] = await tx.select().from(bankTransactions).where(eq(bankTransactions.id, current.bankTransactionId)).for("update");
        if (!transaction || transaction.isCleared || transaction.isReconciled || transaction.reconciliationId) throw new CheckError("A cleared check or a check assigned to reconciliation cannot be voided here");
        const paid = moneyToCents(bill.amountPaid || "0") - moneyToCents(current.amount);
        if (paid < 0) throw new CheckError("Bill balance needs review before voiding");
        const due = moneyToCents(bill.total) - paid;
        await tx.update(bills).set({ amountPaid: (paid / 100).toFixed(2), amountDue: (due / 100).toFixed(2), status: paid === 0 ? "pending" : due === 0 ? "paid" : "partial" }).where(eq(bills.id, bill.id));
        await tx.update(bankAccounts).set({ currentBalance: sql`(${bankAccounts.currentBalance}::numeric + ${current.amount}::numeric)::text` }).where(eq(bankAccounts.id, current.bankAccountId));
        await tx.update(bankTransactions).set({ amount: "0.00", description: `VOID check ${current.reference}` }).where(eq(bankTransactions.id, transaction.id));
        const [result] = await tx.update(billPayments).set({ amount: "0.00", checkDetails: { ...current.checkDetails, status: "void", voidedAt: new Date().toISOString(), voidedBy: req.session.userId } }).where(eq(billPayments.id, current.id)).returning();
        return result;
      });
      res.json(payment);
    } catch (e) {
      if (e instanceof CheckError) return res.status(400).json({ message: e.message });
      console.error("Check void failed", e);
      res.status(500).json({ message: "Unable to void check" });
    }
  });
}
