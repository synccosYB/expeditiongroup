import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  accounts, bankAccounts, bankTransactions, deposits, invoices, payments,
  type BankAccount, type InsertDeposit, type InsertPayment, type Invoice,
} from "@shared/schema";
import { billingDate, centsToDollars } from "@shared/client-retainers";
import { BillingConflict, invoiceSettlement, lockInvoice, storedCents, syncSettledInvoice } from "./client-retainer-service";
import { getBankLedgerAccount } from "./client-retainer-ledger";
import type { db } from "./db";

type Database = Pick<typeof db, "select" | "transaction">;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function nextCustomerPaymentNumber(database: Pick<Database, "select">) {
  const prefix = `PMT-${new Date().getFullYear()}-`;
  const [last] = await database.select({ number: payments.paymentNumber }).from(payments)
    .where(sql`${payments.paymentNumber} LIKE ${prefix + "%"}`)
    .orderBy(desc(sql`length(${payments.paymentNumber})`), desc(payments.paymentNumber)).limit(1);
  const next = (Number.parseInt(last?.number.slice(prefix.length) ?? "0", 10) || 0) + 1;
  return prefix + String(next).padStart(4, "0");
}

async function insertCashPayment(tx: Tx, input: InsertPayment) {
  let paymentNumber = input.paymentNumber;
  if (!paymentNumber) {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(298175106, 1)`);
    paymentNumber = await nextCustomerPaymentNumber(tx);
  }
  const [payment] = await tx.insert(payments).values({ ...input, paymentNumber }).returning();
  return payment;
}

function validateCashAllocation(invoice: Invoice, clientId: number, amount: number, remaining: number) {
  if (invoice.clientId && invoice.clientId !== clientId)
    throw new BillingConflict("Select an invoice for this client.");
  if (amount <= 0 || amount > remaining)
    throw new BillingConflict(`Payment exceeds the remaining balance of invoice ${invoice.invoiceNumber} or has an invalid amount.`);
}

export async function recordCustomerPayments(database: Database, inputs: InsertPayment[], bulk = false) {
  return database.transaction(async (tx) => {
    const invoiceIds = Array.from(new Set(inputs.flatMap(({ invoiceId }) => invoiceId ? [invoiceId] : [])))
      .sort((a, b) => a - b);
    const locked = new Map<number, Invoice>();
    for (const invoiceId of invoiceIds) {
      const invoice = await lockInvoice(tx, invoiceId);
      if (!invoice) throw new BillingConflict("Invoice not found.", 404);
      locked.set(invoiceId, invoice);
    }
    const created = [];
    for (const input of inputs) {
      const invoice = input.invoiceId ? locked.get(input.invoiceId) : undefined;
      if (!invoice) {
        created.push(await insertCashPayment(tx, input));
        continue;
      }
      const { settledCents, appliedCents } = await invoiceSettlement(tx, invoice.id);
      const total = storedCents(invoice.total);
      const amount = storedCents(input.amount);
      if (bulk || appliedCents > 0)
        validateCashAllocation(invoice, input.clientId, amount, total - settledCents);
      created.push(await insertCashPayment(tx, input));
      if (settledCents + amount >= total && invoice.status !== "paid") {
        const now = new Date();
        await tx.update(invoices).set({
          status: "paid", updatedAt: now, ...(appliedCents > 0 && { paidAt: now }),
        }).where(eq(invoices.id, invoice.id));
        locked.set(invoice.id, { ...invoice, status: "paid" });
      }
    }
    return created;
  });
}

export async function editCustomerPayment(database: Database, id: number, input: Partial<InsertPayment>) {
  return database.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.id, id)).for("update");
    if (!payment) return;
    if (payment.retainerRequestId)
      throw new BillingConflict("Manage retainer receipts from the client’s Billing tab.");
    const newInvoiceId = input.invoiceId === undefined ? payment.invoiceId : input.invoiceId;
    const ids = Array.from(new Set([payment.invoiceId, newInvoiceId])).filter((value): value is number => value != null)
      .sort((a, b) => a - b);
    const touched: { invoice: Invoice; settledCents: number }[] = [];
    for (const invoiceId of ids) {
      const invoice = await lockInvoice(tx, invoiceId);
      if (!invoice) throw new BillingConflict("Invoice not found.", 404);
      const { applications, appliedCents, settledCents } = await invoiceSettlement(tx, invoiceId);
      if (!applications.length) continue;
      const oldAmount = invoiceId === payment.invoiceId ? storedCents(payment.amount) : 0;
      const newAmount = invoiceId === newInvoiceId ? storedCents(input.amount ?? payment.amount) : 0;
      if (invoiceId === newInvoiceId && appliedCents > 0
        && (invoice.clientId !== (input.clientId ?? payment.clientId) || newAmount <= 0
          || settledCents - oldAmount + newAmount > storedCents(invoice.total)))
        throw new BillingConflict("This edit would exceed the invoice balance or move the payment to another client.");
      touched.push({ invoice, settledCents: settledCents - oldAmount + newAmount });
    }
    const now = new Date();
    const [updated] = await tx.update(payments).set({ ...input, updatedAt: now }).where(eq(payments.id, id)).returning();
    for (const { invoice, settledCents } of touched) await syncSettledInvoice(tx, invoice, settledCents, now);
    return updated;
  });
}

export async function removeCustomerPayment(database: Database, id: number) {
  return database.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.id, id)).for("update");
    if (!payment) return false;
    if (payment.retainerRequestId)
      throw new BillingConflict("Void retainer receipts from the client’s Billing tab.");
    if (payment.isDeposited || payment.depositId)
      throw new BillingConflict("Cannot delete a deposited payment.", 400);
    const invoice = payment.invoiceId ? await lockInvoice(tx, payment.invoiceId) : undefined;
    await tx.delete(payments).where(eq(payments.id, id));
    if (invoice?.status === "paid") {
      const { settledCents } = await invoiceSettlement(tx, invoice.id);
      await syncSettledInvoice(tx, invoice, settledCents, new Date());
    }
    return true;
  });
}

async function fillPaidInvoice(tx: Tx, invoice: Invoice, actor: string | undefined, date: Date) {
  if (invoice.status !== "paid" || !invoice.clientId) return false;
  const { settledCents, appliedCents } = await invoiceSettlement(tx, invoice.id);
  const remaining = storedCents(invoice.total) - settledCents;
  if (remaining <= (appliedCents > 0 ? 0 : 1)) return false;
  await insertCashPayment(tx, {
    paymentNumber: "", clientId: invoice.clientId, invoiceId: invoice.id,
    paymentDate: date, amount: centsToDollars(remaining), paymentMethod: "other",
    memo: `Payment for invoice ${invoice.invoiceNumber}`, createdByUserId: actor,
  });
  return true;
}

export async function backfillPaidInvoice(database: Database, invoiceId: number) {
  return database.transaction(async (tx) => {
    const invoice = await lockInvoice(tx, invoiceId);
    if (!invoice) return false;
    return fillPaidInvoice(tx, invoice, undefined, invoice.paidAt ?? invoice.createdAt ?? new Date());
  });
}

export async function updateInvoiceAndPayment(
  database: Database, invoiceId: number, input: Partial<typeof invoices.$inferInsert>, actor?: string,
) {
  return database.transaction(async (tx) => {
    const invoice = await lockInvoice(tx, invoiceId);
    if (!invoice) return;
    const { applications, activeApplications, appliedCents, settledCents } = await invoiceSettlement(tx, invoiceId);
    if (applications.length && (
      (input.clientId !== undefined && input.clientId !== invoice.clientId)
      || (input.projectId !== undefined && input.projectId !== invoice.projectId)
    )) throw new BillingConflict("An invoice with retainer history cannot be moved to another client or project.");

    const total = storedCents(input.total ?? invoice.total);
    let status = input.status ?? invoice.status;
    if (appliedCents > 0) {
      if (status === "draft" || status === "cancelled")
        throw new BillingConflict("Reverse the invoice’s retainer applications before cancelling it or moving it to draft.");
      if (total < settledCents)
        throw new BillingConflict("Invoice total cannot be below its cash payments and retainer applications.");
      const issueDate = input.createdAt && billingDate(input.createdAt);
      if (issueDate && activeApplications.some((row) => billingDate(row.appliedAt) < issueDate))
        throw new BillingConflict("Invoice date cannot be after a retainer application.");
      if (status === "sent" && total === settledCents) status = "paid";
      if (invoice.status === "paid" && input.status === undefined && total > settledCents)
        throw new BillingConflict("Reverse the retainer applications before increasing a paid invoice’s total.");
    }
    const now = new Date();
    const [updated] = await tx.update(invoices).set({ ...input, status, updatedAt: now })
      .where(eq(invoices.id, invoiceId)).returning();
    if (actor && (input.status === "paid" || input.status === undefined))
      await fillPaidInvoice(tx, updated, actor, input.paidAt ?? now);
    return updated;
  });
}

export async function postCustomerDeposit(database: Database, input: InsertDeposit, paymentIds: number[]) {
  const ids = Array.from(new Set(paymentIds));
  if (ids.length !== paymentIds.length)
    throw new BillingConflict("Select each payment only once.", 400);
  return database.transaction(async (tx) => {
    const selected = await tx.select().from(payments).where(and(
      inArray(payments.id, ids), eq(payments.isDeposited, false), isNull(payments.retainerVoidedAt),
    )).orderBy(asc(payments.id)).for("update");
    if (selected.length !== ids.length || selected.some((payment) => payment.depositId))
      throw new BillingConflict("One or more payments were already deposited, voided, or removed.");
    const totalCents = selected.reduce((sum, payment) => sum + storedCents(payment.amount), 0);
    if (storedCents(input.totalAmount) !== totalCents)
      throw new BillingConflict("Deposit total must match the selected payments.", 400);
    const [bank] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, input.bankAccountId)).for("update");
    if (!bank) throw new BillingConflict("Bank account not found.", 404);
    if (selected.some((payment) => payment.retainerRequestId)) {
      const chart = await tx.select().from(accounts).orderBy(asc(accounts.id));
      const offset = getBankLedgerAccount(chart, bank.linkedAccountId);
      if (bank.isActive === false || bank.accountType === "credit_card"
        || offset?.accountType !== "asset" || offset.isActive === false) {
        throw new BillingConflict("Select an active bank or cash account with an asset account in the chart of accounts.");
      }
    }
    const now = new Date();
    const amount = centsToDollars(totalCents);
    const [transaction] = await tx.insert(bankTransactions).values({
      bankAccountId: bank.id, transactionDate: input.depositDate, transactionType: "deposit",
      payee: "Customer Payments", description: input.memo || `Deposit of ${ids.length} payment(s)`, amount,
    }).returning();
    const [deposit] = await tx.insert(deposits).values({ ...input, totalAmount: amount, bankTransactionId: transaction.id }).returning();
    const updatedPayments = await tx.update(payments).set({
      isDeposited: true, depositId: deposit.id, depositedAt: now, updatedAt: now,
    }).where(inArray(payments.id, ids)).returning();
    await refreshBankBalance(tx, bank, now);
    return { ...deposit, payments: updatedPayments };
  });
}

async function refreshBankBalance(tx: Tx, bank: BankAccount, now: Date) {
  const bankEntries = await tx.select({ amount: bankTransactions.amount, type: bankTransactions.transactionType })
    .from(bankTransactions).where(eq(bankTransactions.bankAccountId, bank.id));
  const balance = bankEntries.reduce((sum, entry) =>
    sum + (entry.type === "deposit" || entry.type === "refund" ? 1 : -1) * storedCents(entry.amount),
    storedCents(bank.openingBalance ?? "0"));
  await tx.update(bankAccounts).set({ currentBalance: centsToDollars(balance), updatedAt: now })
    .where(eq(bankAccounts.id, bank.id));
}

export async function removeCustomerDeposit(database: Database, id: number) {
  return database.transaction(async (tx) => {
    const [deposit] = await tx.select().from(deposits).where(eq(deposits.id, id)).for("update");
    if (!deposit) return false;
    const selected = await tx.select().from(payments).where(eq(payments.depositId, id))
      .orderBy(asc(payments.id)).for("update");
    const [bank] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, deposit.bankAccountId)).for("update");
    const bankRows = await tx.select().from(bankTransactions).where(deposit.bankTransactionId
      ? eq(bankTransactions.id, deposit.bankTransactionId)
      : and(eq(bankTransactions.bankAccountId, deposit.bankAccountId), eq(bankTransactions.transactionType, "deposit"),
        eq(bankTransactions.amount, deposit.totalAmount), sql`${bankTransactions.transactionDate}::date = ${deposit.depositDate.toISOString().slice(0, 10)}::date`))
      .limit(2).for("update");
    if (bankRows.length > 1)
      throw new BillingConflict("Multiple bank entries match this deposit.");
    const [transaction] = bankRows;
    if (selected.some((payment) => payment.retainerRequestId)
      && (transaction?.isCleared || transaction?.isReconciled || transaction?.reconciliationId))
      throw new BillingConflict("Review the cleared or reconciled bank entry before reversing this retainer deposit.");
    const now = new Date();
    await tx.update(payments).set({ isDeposited: false, depositId: null, depositedAt: null, updatedAt: now })
      .where(eq(payments.depositId, id));
    await tx.delete(deposits).where(eq(deposits.id, id));
    if (transaction) await tx.delete(bankTransactions).where(eq(bankTransactions.id, transaction.id));
    if (bank) await refreshBankBalance(tx, bank, now);
    return true;
  });
}
