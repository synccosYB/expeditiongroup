import { and, eq, sql } from "drizzle-orm";
import { bankAccounts, bankTransactions, billPayments, bills, vendors, accounts, expenses } from "@shared/schema";
import { moneyToCents, validateCheckPayment, type CheckDetails, type CheckRequest } from "@shared/checkwriter";
import type { db } from "./db";
export class CheckError extends Error {}
type Database = Pick<typeof db, "transaction">;

export async function issueCheck(database: Database, input: CheckRequest, actor: string) {
  return database.transaction(async tx => {
    const [bank] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, input.bankAccountId)).for("update");
    if (!bank || !bank.isActive || bank.accountType !== "checking") throw new CheckError("Select an active checking account");
    if (!bank.checkCompanyName?.trim() || !bank.checkCompanyAddress?.trim()) throw new CheckError("Set the company name and address in Bank Accounts first");
    if (!/^\d{9}$/.test(bank.routingNumber || "") || !/^\d{5,17}$/.test(bank.accountNumber || "")) throw new CheckError("Set the full account number and nine-digit routing number in Bank Accounts first");
    const [bill] = input.billId ? await tx.select().from(bills).where(eq(bills.id, input.billId)).for("update") : [];
    if (input.billId && (!bill || bill.status === "void" || bill.status === "draft")) throw new CheckError("Select an open vendor bill");
    if (bill && input.vendorId && input.vendorId !== bill.vendorId) throw new CheckError("The selected vendor does not match the bill");
    let cents: number;
    try { cents = bill ? validateCheckPayment(input.amount, bill.total, bill.amountPaid || "0") : moneyToCents(input.amount); }
    catch (e) { throw new CheckError((e as Error).message); }
    if (cents <= 0) throw new CheckError("Enter a positive check amount");
    const existing = await tx.select({ id: bankTransactions.id }).from(bankTransactions).where(and(eq(bankTransactions.bankAccountId, bank.id), eq(bankTransactions.checkNumber, input.number)));
    if (existing.length) throw new CheckError("This check number has already been used for this bank account");
    const vendorId = bill?.vendorId || input.vendorId;
    const [vendor] = vendorId ? await tx.select().from(vendors).where(eq(vendors.id, vendorId)) : [];
    if (vendorId && (!vendor || vendor.isActive === false)) throw new CheckError("Select an active vendor");
    if (!bill) {
      const [category] = input.accountId ? await tx.select().from(accounts).where(eq(accounts.id, input.accountId)) : [];
      if (!category?.isActive || category.accountType !== "expense") throw new CheckError("Select an active expense account for the standalone check");
    }
    const payee = vendor?.name || input.payee?.trim();
    if (!payee) throw new CheckError("Enter a payee");
    if (input.printSignature && !bank.checkSignature) throw new CheckError("Save an authorized signature in Bank Accounts first");
    const amount = (cents / 100).toFixed(2);
    const details: CheckDetails = {
      number: input.number, date: input.date, amount, payee,
      payeeAddress: vendor ? [vendor.address, [vendor.city, vendor.state, vendor.zip].filter(Boolean).join(", ")].filter(Boolean).join("\n") : input.payeeAddress || "",
      companyName: bank.checkCompanyName, companyAddress: bank.checkCompanyAddress,
      routingNumber: bank.routingNumber || "", accountNumber: bank.accountNumber || "",
      signature: input.printSignature ? bank.checkSignature || undefined : undefined,
      bankName: bank.bankName || "", billNumber: bill?.billNumber || "", billId: bill?.id,
      memo: input.memo, attachment: input.attachment, status: "issued", issuedBy: actor,
    };
    const [transaction] = await tx.insert(bankTransactions).values({
      bankAccountId: bank.id, transactionDate: new Date(input.date + "T12:00:00"), transactionType: "check",
      payee, vendorId, accountId: bill ? undefined : input.accountId,
      description: bill ? `Check payment - ${details.billNumber}` : input.memo || "Standalone check",
      reference: input.number, checkNumber: input.number, amount,
      isCleared: false, isReconciled: false, checkDetails: details,
    }).returning();
    let payment;
    if (bill) {
      [payment] = await tx.insert(billPayments).values({ billId: bill.id, bankAccountId: bank.id, bankTransactionId: transaction.id, paymentDate: transaction.transactionDate, amount, paymentMethod: "check", reference: input.number, checkDetails: details }).returning();
      const paid = moneyToCents(bill.amountPaid || "0") + cents, due = moneyToCents(bill.total) - paid;
      await tx.update(bills).set({ amountPaid: (paid / 100).toFixed(2), amountDue: (due / 100).toFixed(2), status: due === 0 ? "paid" : "partial" }).where(eq(bills.id, bill.id));
    } else {
      await tx.insert(expenses).values({ vendorId, bankAccountId: bank.id, bankTransactionId: transaction.id, expenseDate: transaction.transactionDate, accountId: input.accountId, amount, description: input.memo || `Check to ${payee}`, reference: input.number, paymentType: "check", status: "paid", receiptUrl: input.attachment?.path, createdByUserId: actor });
    }
    await tx.update(bankAccounts).set({ nextCheckNumber: Math.max(bank.nextCheckNumber || 1, Number(input.number) + 1), currentBalance: sql`(coalesce(nullif(${bankAccounts.currentBalance}, ''), '0')::numeric - ${amount}::numeric)::text` }).where(eq(bankAccounts.id, bank.id));
    return { transaction, payment };
  });
}

export async function voidCheck(database: Database, transactionId: number, bankAccountId: number, actor: string, remove = false) {
  return database.transaction(async tx => {
    // Match issuance's lock order. The bank id comes from a read before the transaction.
    await tx.select().from(bankAccounts).where(eq(bankAccounts.id, bankAccountId)).for("update");
    const payments = await tx.select().from(billPayments).where(eq(billPayments.bankTransactionId, transactionId));
    if (payments.length > 1) throw new CheckError("Multiple bill payments are linked to this check; review before reversing");
    const [payment] = payments;
    const [bill] = payment ? await tx.select().from(bills).where(eq(bills.id, payment.billId)).for("update") : [];
    const [transaction] = await tx.select().from(bankTransactions).where(eq(bankTransactions.id, transactionId)).for("update");
    const details = transaction?.checkDetails || payment?.checkDetails;
    if (!transaction || transaction.bankAccountId !== bankAccountId || !details) throw new CheckError("Printed check not found");
    if (transaction.linkedTransactionId) throw new CheckError("This check is linked to another bank transaction; review before reversing");
    if (details.status === "void" && !remove) return transaction;
    if (transaction.isCleared || transaction.isReconciled || transaction.reconciliationId) throw new CheckError("A cleared check or a check assigned to reconciliation cannot be voided or deleted here");
    const linkedExpenses = await tx.select().from(expenses).where(eq(expenses.bankTransactionId, transactionId)).for("update");
    if (linkedExpenses.some(e => e.isRebilled)) throw new CheckError("This expense has been rebilled; review it before voiding or deleting the check");
    if (details.status !== "void") {
      if (payment) {
        if (moneyToCents(payment.amount) !== moneyToCents(transaction.amount)) throw new CheckError("Check and bill payment amounts differ; review them before voiding");
        if (!bill) throw new CheckError("Linked bill no longer exists");
        const paid = moneyToCents(bill.amountPaid || "0") - moneyToCents(payment.amount), due = moneyToCents(bill.total) - paid;
        if (paid < 0) throw new CheckError("Bill balance needs review before voiding");
        await tx.update(bills).set({ amountPaid: (paid / 100).toFixed(2), amountDue: (due / 100).toFixed(2), status: paid === 0 ? "pending" : due === 0 ? "paid" : "partial" }).where(eq(bills.id, bill.id));
      } else {
        await tx.update(expenses).set({ amount: "0.00", status: "void" }).where(eq(expenses.bankTransactionId, transactionId));
      }
    }
    if (remove) {
      await tx.delete(expenses).where(eq(expenses.bankTransactionId, transactionId));
      await tx.delete(billPayments).where(eq(billPayments.bankTransactionId, transactionId));
      await tx.delete(bankTransactions).where(eq(bankTransactions.id, transactionId));
      if (details.status !== "void") await tx.update(bankAccounts).set({ currentBalance: sql`(coalesce(nullif(${bankAccounts.currentBalance}, ''), '0')::numeric + ${transaction.amount}::numeric)::text` }).where(eq(bankAccounts.id, bankAccountId));
      return transaction;
    }
    const voided: CheckDetails = { ...details, status: "void", voidedAt: new Date().toISOString(), voidedBy: actor };
    await tx.update(bankAccounts).set({ currentBalance: sql`(${bankAccounts.currentBalance}::numeric + ${transaction.amount}::numeric)::text` }).where(eq(bankAccounts.id, bankAccountId));
    if (payment) await tx.update(billPayments).set({ amount: "0.00", checkDetails: voided }).where(eq(billPayments.id, payment.id));
    const [result] = await tx.update(bankTransactions).set({ amount: "0.00", description: `VOID check ${details.number}`, checkDetails: voided }).where(eq(bankTransactions.id, transactionId)).returning();
    return result;
  });
}

export async function deleteCheck(database: Database, transactionId: number, bankAccountId: number, actor: string) {
  return voidCheck(database, transactionId, bankAccountId, actor, true);
}

// Fill missing print fields only. Never silently replace a previously saved bank number or signature.
export async function completeCheckPrintDetails(database: Database, transactionId: number, bankAccountId: number) {
  return database.transaction(async tx => {
    const [bank] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, bankAccountId)).for("update");
    const [transaction] = await tx.select().from(bankTransactions).where(eq(bankTransactions.id, transactionId)).for("update");
    const [payment] = await tx.select().from(billPayments).where(eq(billPayments.bankTransactionId, transactionId));
    const details = transaction?.checkDetails || payment?.checkDetails;
    if (!bank || !transaction || transaction.bankAccountId !== bankAccountId || !details) throw new CheckError("Printed check not found");
    if (details.status === "void") throw new CheckError("A void check cannot be signed");
    const updated: CheckDetails = { ...details,
      routingNumber: details.routingNumber || bank.routingNumber || "",
      accountNumber: details.accountNumber || bank.accountNumber || "",
      signature: details.signature || bank.checkSignature || undefined,
    };
    if (!/^\d{9}$/.test(updated.routingNumber || "") || !/^\d{5,17}$/.test(updated.accountNumber || "")) throw new CheckError("Save the full routing and account numbers in Bank Accounts first");
    await tx.update(bankTransactions).set({ checkDetails: updated }).where(eq(bankTransactions.id, transactionId));
    if (payment) await tx.update(billPayments).set({ checkDetails: updated }).where(eq(billPayments.id, payment.id));
    return updated;
  });
}
