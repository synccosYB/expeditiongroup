// Ordinary bill payments share the same bill row lock as vendor-credit applications.
// This prevents a simultaneous cash payment and credit application from overpaying.
import { eq, inArray, sql } from "drizzle-orm";
import {
  bankAccounts,
  bankTransactions,
  billPayments,
  bills,
  vendors,
} from "@shared/schema";
import { moneyToCents } from "@shared/checkwriter";
import { creditMoney } from "@shared/vendor-credits";
import { z } from "zod";
import type { db } from "./db";
import { VendorCreditError } from "./vendor-credit-service";
const paymentSchema = z.object({
  amount: creditMoney,
  bankAccountId: z.coerce.number().int().positive(),
  paymentDate: z.coerce.date(),
  paymentMethod: z.string().max(50).nullable().optional(),
  reference: z.string().max(100).nullable().optional(),
});
const money = (value: number) => (value / 100).toFixed(2);
export async function mutateBillPayment(
  database: Pick<typeof db, "transaction">,
  operation: "create" | "update" | "delete",
  id: number,
  raw: Record<string, unknown> = {},
) {
  return database.transaction(async (tx) => {
    const [snapshot] =
      operation === "create"
        ? []
        : await tx.select().from(billPayments).where(eq(billPayments.id, id));
    if (operation !== "create" && !snapshot)
      throw new VendorCreditError("Bill payment not found");
    if (snapshot?.checkDetails)
      throw new VendorCreditError("Use Void check for printed checks");
    const values: Record<string, unknown> = { ...snapshot, ...raw };
    if (
      typeof values.paymentDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(values.paymentDate)
    )
      values.paymentDate += "T12:00:00";
    const input =
      operation === "delete" ? undefined : paymentSchema.parse(values);
    const bankIds = Array.from(
      new Set(
        [snapshot?.bankAccountId, input?.bankAccountId].filter(
          (v): v is number => !!v,
        ),
      ),
    ).sort((a, b) => a - b);
    const banks = await tx
      .select()
      .from(bankAccounts)
      .where(inArray(bankAccounts.id, bankIds))
      .orderBy(bankAccounts.id)
      .for("update");
    const [bill] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, snapshot?.billId || id))
      .for("update");
    if (!bill) throw new VendorCreditError("Bill not found");
    if (
      operation !== "delete" &&
      (bill.status === "draft" || bill.status === "void")
    )
      throw new VendorCreditError("Select an open bill");
    if (snapshot) {
      const [current] = await tx
        .select()
        .from(billPayments)
        .where(eq(billPayments.id, snapshot.id))
        .for("update");
      if (
        !current ||
        current.amount !== snapshot.amount ||
        current.bankAccountId !== snapshot.bankAccountId ||
        current.bankTransactionId !== snapshot.bankTransactionId ||
        current.checkDetails
      )
        throw new VendorCreditError("Payment changed; refresh and try again");
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
        "Cleared, reconciled or linked payments cannot be changed here",
      );
    if (
      snapshot?.bankTransactionId &&
      (!oldTransaction ||
        moneyToCents(oldTransaction.amount) !== moneyToCents(snapshot.amount))
    )
      throw new VendorCreditError(
        "Payment and bank register differ; review before changing",
      );
    const oldCents = snapshot ? moneyToCents(snapshot.amount) : 0,
      newCents = input ? moneyToCents(input.amount) : 0;
    const paid = moneyToCents(bill.amountPaid || "0") - oldCents + newCents;
    const credited = moneyToCents(bill.amountCredited || "0");
    const due = moneyToCents(bill.total) - paid - credited;
    if (paid < 0 || due < 0)
      throw new VendorCreditError(
        "Payment cannot exceed the unpaid bill balance",
      );
    const bank = input
      ? banks.find((b) => b.id === input.bankAccountId)
      : undefined;
    if (input && !bank?.isActive)
      throw new VendorCreditError("Select an active bank account");
    if (snapshot && !banks.some((b) => b.id === snapshot.bankAccountId))
      throw new VendorCreditError("Original bank account not found");
    const [vendor] = await tx
      .select()
      .from(vendors)
      .where(eq(vendors.id, bill.vendorId));
    let result;
    if (input && bank) {
      const transactionValues = {
        bankAccountId: bank.id,
        transactionDate: input.paymentDate,
        transactionType:
          bank.accountType === "credit_card"
            ? ("payment" as const)
            : ("withdrawal" as const),
        amount: money(newCents),
        vendorId: bill.vendorId,
        payee: vendor?.name,
        description: `Bill Payment - ${bill.billNumber}`,
        reference: input.reference,
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
      const paymentValues = {
        billId: bill.id,
        bankAccountId: bank.id,
        bankTransactionId: transaction.id,
        paymentDate: input.paymentDate,
        amount: money(newCents),
        paymentMethod: input.paymentMethod,
        reference: input.reference,
      };
      [result] = snapshot
        ? await tx
            .update(billPayments)
            .set(paymentValues)
            .where(eq(billPayments.id, snapshot.id))
            .returning()
        : await tx.insert(billPayments).values(paymentValues).returning();
    } else if (snapshot) {
      await tx.delete(billPayments).where(eq(billPayments.id, snapshot.id));
      if (oldTransaction)
        await tx
          .delete(bankTransactions)
          .where(eq(bankTransactions.id, oldTransaction.id));
    }
    for (const account of banks) {
      const reversed =
        oldTransaction?.bankAccountId === account.id ? oldCents : 0;
      const outgoing = input?.bankAccountId === account.id ? newCents : 0;
      const delta = money(
        (account.accountType === "credit_card" ? -1 : 1) *
          (reversed - outgoing),
      );
      await tx
        .update(bankAccounts)
        .set({
          currentBalance: sql`(coalesce(nullif(${bankAccounts.currentBalance}, ''), '0')::numeric + ${delta}::numeric)::text`,
        })
        .where(eq(bankAccounts.id, account.id));
    }
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
    return result || { message: "Bill payment deleted successfully" };
  });
}
