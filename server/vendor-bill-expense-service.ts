import { eq, inArray, sql } from "drizzle-orm";
import {
  bankAccounts,
  bankTransactions,
  billPayments,
  bills,
  expenses,
} from "@shared/schema";
import { moneyToCents } from "@shared/checkwriter";
import { creditMoney } from "@shared/vendor-credits";
import { VendorCreditError } from "./vendor-credit-service";
import type { db } from "./db";
const money = (cents: number) => (cents / 100).toFixed(2);
// The Expenses screen has a separate legacy Pay Bill flow. Keep its rows and
// history, but update its bank and bill balances in the same transaction.
export async function mutateBillExpense(
  database: Pick<typeof db, "transaction">,
  operation: "create" | "update" | "delete",
  id: number | null,
  input: Partial<typeof expenses.$inferInsert> = {},
) {
  return database.transaction(async (tx) => {
    const [snapshot] = id
      ? await tx.select().from(expenses).where(eq(expenses.id, id))
      : [];
    if (operation !== "create" && !snapshot)
      throw new VendorCreditError("Expense not found");
    if (snapshot?.isRebilled)
      throw new VendorCreditError(
        "Review the rebilled invoice before changing this payment",
      );
    const {
      createdAt,
      updatedAt,
      bankTransactionId,
      isRebilled,
      rebilledInvoiceId,
      rebilledAt,
      ...editable
    } = input;
    const values = { ...snapshot, ...editable };
    const deleting = operation === "delete";
    const oldBillId =
      snapshot?.paymentType === "pay_bill" ? snapshot.billId : null;
    const newBillId =
      !deleting && values.paymentType === "pay_bill" ? values.billId : null;
    if (
      !deleting &&
      values.paymentType === "pay_bill" &&
      (!newBillId || !values.bankAccountId || values.status === "void")
    )
      throw new VendorCreditError(
        "Select a bill and bank account for this payment",
      );
    const bankIds = Array.from(
      new Set(
        [
          snapshot?.bankAccountId,
          !deleting ? values.bankAccountId : null,
        ].filter((n): n is number => !!n),
      ),
    ).sort((a, b) => a - b);
    const banks = bankIds.length
      ? await tx
          .select()
          .from(bankAccounts)
          .where(inArray(bankAccounts.id, bankIds))
          .orderBy(bankAccounts.id)
          .for("update")
      : [];
    const billIds = Array.from(
      new Set([oldBillId, newBillId].filter((n): n is number => !!n)),
    ).sort((a, b) => a - b);
    const lockedBills = billIds.length
      ? await tx
          .select()
          .from(bills)
          .where(inArray(bills.id, billIds))
          .orderBy(bills.id)
          .for("update")
      : [];
    if (lockedBills.length !== billIds.length)
      throw new VendorCreditError("Bill not found");
    if (snapshot) {
      const [current] = await tx
        .select()
        .from(expenses)
        .where(eq(expenses.id, snapshot.id))
        .for("update");
      if (!current || JSON.stringify(current) !== JSON.stringify(snapshot))
        throw new VendorCreditError("Expense changed; refresh and try again");
    }
    const [oldTransaction] = snapshot?.bankTransactionId
      ? await tx
          .select()
          .from(bankTransactions)
          .where(eq(bankTransactions.id, snapshot.bankTransactionId))
          .for("update")
      : [];
    if (
      oldTransaction &&
      (oldTransaction.checkDetails ||
        oldTransaction.isCleared ||
        oldTransaction.isReconciled ||
        oldTransaction.reconciliationId ||
        oldTransaction.linkedTransactionId)
    )
      throw new VendorCreditError(
        "Cleared, reconciled or printed payments cannot be changed here",
      );
    if (
      snapshot?.bankTransactionId &&
      (!oldTransaction ||
        moneyToCents(oldTransaction.amount) !== moneyToCents(snapshot.amount))
    )
      throw new VendorCreditError(
        "Expense and bank register differ; review before changing",
      );
    if (
      oldTransaction &&
      (
        await tx
          .select()
          .from(billPayments)
          .where(eq(billPayments.bankTransactionId, oldTransaction.id))
      ).length
    )
      throw new VendorCreditError("Manage this payment from Bills");
    const oldCents = snapshot ? moneyToCents(snapshot.amount) : 0;
    const newCents = deleting
      ? 0
      : moneyToCents(creditMoney.parse(values.amount));
    const newBill = lockedBills.find((b) => b.id === newBillId);
    if (
      newBill &&
      (newBill.status === "draft" ||
        newBill.status === "void" ||
        (values.vendorId && values.vendorId !== newBill.vendorId))
    )
      throw new VendorCreditError("Select an open bill for this vendor");
    for (const bill of lockedBills) {
      const paid =
        moneyToCents(bill.amountPaid || "0") -
        (bill.id === oldBillId ? oldCents : 0) +
        (bill.id === newBillId ? newCents : 0);
      const credited = moneyToCents(bill.amountCredited || "0");
      const due = moneyToCents(bill.total) - paid - credited;
      if (paid < 0 || due < 0)
        throw new VendorCreditError(
          "Payment cannot exceed the unpaid bill balance",
        );
      await tx
        .update(bills)
        .set({
          amountPaid: money(paid),
          amountDue: money(due),
          status:
            due === 0 ? "paid" : paid + credited > 0 ? "partial" : "pending",
          updatedAt: new Date(),
        })
        .where(eq(bills.id, bill.id));
    }
    const newBank = !deleting
      ? banks.find((b) => b.id === values.bankAccountId)
      : undefined;
    if (!deleting && values.bankAccountId && !newBank?.isActive)
      throw new VendorCreditError("Select an active bank account");
    let newTransactionId: number | null = null;
    if (newBank) {
      if (!values.expenseDate || isNaN(new Date(values.expenseDate).getTime()))
        throw new VendorCreditError("Enter a valid expense date");
      const transactionValues = {
        bankAccountId: newBank.id,
        transactionDate: values.expenseDate,
        transactionType:
          newBank.accountType === "credit_card"
            ? ("payment" as const)
            : values.paymentType === "check"
              ? ("check" as const)
              : ("withdrawal" as const),
        vendorId: newBill?.vendorId || values.vendorId,
        amount: money(newCents),
        description: `Expense - ${values.description || ""}`,
        reference: values.reference,
        accountId: values.accountId,
      };
      const [transaction] = oldTransaction
        ? await tx
            .update(bankTransactions)
            .set(transactionValues)
            .where(eq(bankTransactions.id, oldTransaction.id))
            .returning()
        : await tx
            .insert(bankTransactions)
            .values(transactionValues)
            .returning();
      newTransactionId = transaction.id;
    }
    let result;
    if (deleting && snapshot)
      await tx.delete(expenses).where(eq(expenses.id, snapshot.id));
    else {
      const expenseValues = {
        ...editable,
        billId: newBillId || null,
        vendorId: newBill?.vendorId || values.vendorId,
        amount: money(newCents),
        bankTransactionId: newTransactionId,
        status: newBank ? ("paid" as const) : ("pending" as const),
        updatedAt: new Date(),
      };
      [result] = snapshot
        ? await tx
            .update(expenses)
            .set(expenseValues)
            .where(eq(expenses.id, snapshot.id))
            .returning()
        : await tx
            .insert(expenses)
            .values({ ...expenseValues, expenseDate: values.expenseDate! })
            .returning();
    }
    if (!newBank && oldTransaction)
      await tx
        .delete(bankTransactions)
        .where(eq(bankTransactions.id, oldTransaction.id));
    for (const bank of banks) {
      const reversed = oldTransaction?.bankAccountId === bank.id ? oldCents : 0;
      const outgoing = newBank?.id === bank.id ? newCents : 0;
      const delta = money(
        (bank.accountType === "credit_card" ? -1 : 1) * (reversed - outgoing),
      );
      await tx
        .update(bankAccounts)
        .set({
          currentBalance: sql`(coalesce(nullif(${bankAccounts.currentBalance}, ''), '0')::numeric + ${delta}::numeric)::text`,
        })
        .where(eq(bankAccounts.id, bank.id));
    }
    return result || { message: "Expense deleted successfully" };
  });
}
