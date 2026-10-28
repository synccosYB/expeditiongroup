import { eq, sql } from "drizzle-orm";
import {
  accounts,
  auditLogs,
  bankAccounts,
  bankTransactions,
  bills,
  vendorCredits,
  vendorCreditApplications,
  vendorRefunds,
  vendors,
} from "@shared/schema";
import { moneyToCents } from "@shared/checkwriter";
import {
  vendorCreditSchema,
  creditApplicationSchema,
  vendorRefundSchema,
  type VendorCreditInput,
  type CreditApplicationInput,
  type VendorRefundInput,
} from "@shared/vendor-credits";
import type { db } from "./db";
export class VendorCreditError extends Error {}
type Database = Pick<typeof db, "transaction">;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
const money = (cents: number) => (cents / 100).toFixed(2);
const date = (value: string) => new Date(value + "T12:00:00");
const audit = async (
  tx: Tx,
  actor: string,
  action: "create" | "delete",
  entityType: string,
  row: { id: number },
) => {
  await tx
    .insert(auditLogs)
    .values({
      userId: actor,
      action,
      entityType,
      entityId: String(row.id),
      metadata: row,
      isVisibleToClient: false,
    });
};
async function requestLock(tx: Tx, requestId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${requestId}))`);
}
async function lockCredit(tx: Tx, id: number) {
  const [credit] = await tx
    .select()
    .from(vendorCredits)
    .where(eq(vendorCredits.id, id))
    .for("update");
  if (!credit) throw new VendorCreditError("Vendor credit not found");
  return credit;
}
async function available(tx: Tx, credit: typeof vendorCredits.$inferSelect) {
  const applications = await tx
    .select()
    .from(vendorCreditApplications)
    .where(eq(vendorCreditApplications.creditId, credit.id));
  const refunds = await tx
    .select()
    .from(vendorRefunds)
    .where(eq(vendorRefunds.creditId, credit.id));
  return (
    moneyToCents(credit.amount) -
    [...applications, ...refunds].reduce(
      (sum, row) => sum + moneyToCents(row.amount),
      0,
    )
  );
}
function checkDate(eventDate: string, creditDate: Date) {
  if (date(eventDate) < creditDate)
    throw new VendorCreditError("Date cannot be before the vendor credit date");
}
export async function createVendorCredit(
  database: Database,
  raw: VendorCreditInput,
  actor: string,
) {
  const input = vendorCreditSchema.parse(raw);
  return database.transaction(async (tx) => {
    await requestLock(tx, input.requestId);
    const [existing] = await tx
      .select()
      .from(vendorCredits)
      .where(eq(vendorCredits.requestId, input.requestId));
    if (existing) {
      if (
        existing.vendorId !== input.vendorId ||
        existing.accountId !== input.accountId ||
        moneyToCents(existing.amount) !== moneyToCents(input.amount) ||
        existing.creditDate.getTime() !== date(input.date).getTime() ||
        (existing.reference || "") !== input.reference ||
        (existing.memo || "") !== input.memo
      )
        throw new VendorCreditError(
          "This request was already saved with different details. Close and reopen the form to create another credit.",
        );
      return existing;
    }
    const [vendor] = await tx
      .select()
      .from(vendors)
      .where(eq(vendors.id, input.vendorId));
    const [account] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, input.accountId));
    if (!vendor?.isActive)
      throw new VendorCreditError("Select an active vendor");
    if (!account?.isActive || account.accountType !== "expense")
      throw new VendorCreditError("Select the original expense category");
    const [credit] = await tx
      .insert(vendorCredits)
      .values({
        vendorId: input.vendorId,
        accountId: input.accountId,
        creditDate: date(input.date),
        amount: money(moneyToCents(input.amount)),
        reference: input.reference,
        memo: input.memo,
        requestId: input.requestId,
        createdByUserId: actor,
      })
      .returning();
    await audit(tx, actor, "create", "vendor_credit", credit);
    return credit;
  });
}
export async function applyVendorCredit(
  database: Database,
  id: number,
  raw: CreditApplicationInput,
  actor: string,
) {
  const input = creditApplicationSchema.parse(raw);
  return database.transaction(async (tx) => {
    await requestLock(tx, input.requestId);
    const credit = await lockCredit(tx, id);
    const [existing] = await tx
      .select()
      .from(vendorCreditApplications)
      .where(eq(vendorCreditApplications.requestId, input.requestId));
    if (existing) {
      if (
        existing.creditId !== id ||
        existing.billId !== input.billId ||
        moneyToCents(existing.amount) !== moneyToCents(input.amount) ||
        existing.applicationDate.getTime() !== date(input.date).getTime()
      )
        throw new VendorCreditError(
          "Request already used with different details; reopen the form",
        );
      return existing;
    }
    const [bill] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, input.billId))
      .for("update");
    if (!bill || bill.vendorId !== credit.vendorId)
      throw new VendorCreditError("Select a bill for this vendor");
    if (bill.status === "draft" || bill.status === "void")
      throw new VendorCreditError("Select an open bill");
    checkDate(input.date, credit.creditDate);
    if (date(input.date) < bill.billDate)
      throw new VendorCreditError(
        "Application date cannot be before the bill date",
      );
    const cents = moneyToCents(input.amount);
    const credited = moneyToCents(bill.amountCredited || "0");
    const due =
      moneyToCents(bill.total) -
      moneyToCents(bill.amountPaid || "0") -
      credited;
    if (cents > (await available(tx, credit)))
      throw new VendorCreditError("Amount exceeds available vendor credit");
    if (cents > due)
      throw new VendorCreditError("Amount exceeds the unpaid bill balance");
    const [application] = await tx
      .insert(vendorCreditApplications)
      .values({
        creditId: id,
        billId: bill.id,
        applicationDate: date(input.date),
        amount: money(cents),
        requestId: input.requestId,
        createdByUserId: actor,
      })
      .returning();
    await tx
      .update(bills)
      .set({
        amountCredited: money(credited + cents),
        amountDue: money(due - cents),
        status: due === cents ? "paid" : "partial",
        updatedAt: new Date(),
      })
      .where(eq(bills.id, bill.id));
    await audit(tx, actor, "create", "vendor_credit_application", application);
    return application;
  });
}
export async function refundVendorCredit(
  database: Database,
  id: number,
  raw: VendorRefundInput,
  actor: string,
) {
  const input = vendorRefundSchema.parse(raw);
  return database.transaction(async (tx) => {
    await requestLock(tx, input.requestId);
    const credit = await lockCredit(tx, id);
    const [existing] = await tx
      .select()
      .from(vendorRefunds)
      .where(eq(vendorRefunds.requestId, input.requestId));
    if (existing) {
      const [savedTransaction] = await tx
        .select()
        .from(bankTransactions)
        .where(eq(bankTransactions.id, existing.bankTransactionId));
      if (
        existing.creditId !== id ||
        savedTransaction?.bankAccountId !== input.bankAccountId ||
        moneyToCents(existing.amount) !== moneyToCents(input.amount) ||
        existing.refundDate.getTime() !== date(input.date).getTime() ||
        (existing.reference || "") !== input.reference
      )
        throw new VendorCreditError(
          "Request already used with different details; reopen the form",
        );
      return existing;
    }
    const [bank] = await tx
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, input.bankAccountId))
      .for("update");
    if (!bank?.isActive)
      throw new VendorCreditError(
        "Select an active bank or credit card account",
      );
    checkDate(input.date, credit.creditDate);
    const cents = moneyToCents(input.amount);
    if (cents > (await available(tx, credit)))
      throw new VendorCreditError("Amount exceeds available vendor credit");
    const [vendor] = await tx
      .select()
      .from(vendors)
      .where(eq(vendors.id, credit.vendorId));
    const [transaction] = await tx
      .insert(bankTransactions)
      .values({
        bankAccountId: bank.id,
        vendorId: credit.vendorId,
        transactionType: "refund",
        transactionDate: date(input.date),
        amount: money(cents),
        payee: vendor?.name,
        reference: input.reference,
        description: `Vendor refund — credit #${id}`,
        isCleared: false,
        isReconciled: false,
      })
      .returning();
    const [refund] = await tx
      .insert(vendorRefunds)
      .values({
        creditId: id,
        bankTransactionId: transaction.id,
        refundDate: date(input.date),
        amount: money(cents),
        reference: input.reference,
        requestId: input.requestId,
        createdByUserId: actor,
      })
      .returning();
    const delta = money(bank.accountType === "credit_card" ? -cents : cents);
    await tx
      .update(bankAccounts)
      .set({
        currentBalance: sql`(coalesce(nullif(${bankAccounts.currentBalance}, ''), '0')::numeric + ${delta}::numeric)::text`,
      })
      .where(eq(bankAccounts.id, bank.id));
    await audit(tx, actor, "create", "vendor_refund", refund);
    return refund;
  });
}
export async function removeVendorCreditEntry(
  database: Database,
  creditId: number,
  kind: "credit" | "application" | "refund",
  entryId: number,
  actor: string,
) {
  return database.transaction(async (tx) => {
    const credit = await lockCredit(tx, creditId);
    if (kind === "credit") {
      const applications = await tx
        .select()
        .from(vendorCreditApplications)
        .where(eq(vendorCreditApplications.creditId, creditId));
      const refunds = await tx
        .select()
        .from(vendorRefunds)
        .where(eq(vendorRefunds.creditId, creditId));
      if (applications.length || refunds.length)
        throw new VendorCreditError(
          "Reverse applications and refunds before deleting this credit",
        );
      await audit(tx, actor, "delete", "vendor_credit", credit);
      await tx.delete(vendorCredits).where(eq(vendorCredits.id, creditId));
    } else if (kind === "application") {
      const [entry] = await tx
        .select()
        .from(vendorCreditApplications)
        .where(eq(vendorCreditApplications.id, entryId));
      if (!entry || entry.creditId !== creditId)
        throw new VendorCreditError("Credit application not found");
      const [bill] = await tx
        .select()
        .from(bills)
        .where(eq(bills.id, entry.billId))
        .for("update");
      if (!bill) throw new VendorCreditError("Bill not found");
      await tx
        .delete(vendorCreditApplications)
        .where(eq(vendorCreditApplications.id, entryId));
      const credited =
        moneyToCents(bill.amountCredited) - moneyToCents(entry.amount);
      const settled = moneyToCents(bill.amountPaid || "0") + credited;
      const due = moneyToCents(bill.total) - settled;
      await tx
        .update(bills)
        .set({
          amountCredited: money(credited),
          amountDue: money(due),
          status: due === 0 ? "paid" : settled > 0 ? "partial" : "pending",
          updatedAt: new Date(),
        })
        .where(eq(bills.id, bill.id));
      await audit(tx, actor, "delete", "vendor_credit_application", entry);
    } else {
      const [entry] = await tx
        .select()
        .from(vendorRefunds)
        .where(eq(vendorRefunds.id, entryId));
      if (!entry || entry.creditId !== creditId)
        throw new VendorCreditError("Vendor refund not found");
      const [original] = await tx
        .select()
        .from(bankTransactions)
        .where(eq(bankTransactions.id, entry.bankTransactionId));
      if (!original)
        throw new VendorCreditError("Refund transaction not found");
      const [bank] = await tx
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.id, original.bankAccountId))
        .for("update");
      const [transaction] = await tx
        .select()
        .from(bankTransactions)
        .where(eq(bankTransactions.id, original.id))
        .for("update");
      if (
        transaction.isCleared ||
        transaction.isReconciled ||
        transaction.reconciliationId
      )
        throw new VendorCreditError(
          "A cleared or reconciled refund cannot be reversed here",
        );
      await tx.delete(vendorRefunds).where(eq(vendorRefunds.id, entryId));
      await tx
        .delete(bankTransactions)
        .where(eq(bankTransactions.id, transaction.id));
      const delta = money(
        (bank.accountType === "credit_card" ? 1 : -1) *
          moneyToCents(entry.amount),
      );
      await tx
        .update(bankAccounts)
        .set({
          currentBalance: sql`(coalesce(nullif(${bankAccounts.currentBalance}, ''), '0')::numeric + ${delta}::numeric)::text`,
        })
        .where(eq(bankAccounts.id, bank.id));
      await audit(tx, actor, "delete", "vendor_refund", entry);
    }
    return { success: true };
  });
}
