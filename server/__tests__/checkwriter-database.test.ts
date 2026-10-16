import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableConfig } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import { accounts, vendors, bankAccounts, bankTransactions, bills, billPayments, expenses } from "../../shared/schema";
import { issueCheck, voidCheck, deleteCheck, completeCheckPrintDetails } from "../checkwriter-service";
import { checkRequestSchema } from "../../shared/checkwriter";

test("PostgreSQL check payment lifecycle", async t => {
  const pg = new PGlite(); const database = drizzle(pg);
  for (const table of [accounts, vendors, bankAccounts, bankTransactions, bills, billPayments, expenses]) {
    const config = getTableConfig(table);
    await pg.exec(`CREATE TABLE "${config.name}" (${config.columns.map(c => `"${c.name}" ${c.primary ? "serial primary key" : (c.enumValues ? "text" : c.getSQLType()) + (c.notNull ? " not null" : "")} ${c.primary ? "" : typeof c.default === "boolean" ? "default " + c.default : typeof c.default === "string" ? "default '" + c.default + "'" : ""}`).join(",")})`);
  }
  await pg.exec("ALTER TABLE bill_payments ADD FOREIGN KEY (bill_id) REFERENCES bills(id); ALTER TABLE bill_payments ADD FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id); ALTER TABLE expenses ADD FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id)");
  // Drizzle shares the PostgreSQL query-builder API across the node-postgres and PGlite drivers.
  const serviceDb = database as unknown as Parameters<typeof issueCheck>[0];
  const [category] = await database.insert(accounts).values({ code: "5000", name: "Services", accountType: "expense", isActive: true }).returning();
  const [bank] = await database.insert(bankAccounts).values({ name: "Checking", bankName: "Sample bank", accountType: "checking", accountNumber: "123456789", routingNumber: "021000021", checkCompanyName: "Expedition Group", checkCompanyAddress: "17 Sandybrook Drive", currentBalance: "1000", openingBalance: "1000", isActive: true, nextCheckNumber: 100 }).returning();
  const [vendor] = await database.insert(vendors).values({ name: "Sample Vendor", address: "100 Vendor Avenue", isActive: true }).returning();
  const input = (number: string, overrides: object = {}) => checkRequestSchema.parse({ bankAccountId: bank.id, number, amount: "100", date: "2026-10-13", memo: "Services", vendorId: vendor.id, accountId: category.id, ...overrides });
  const newBill = async () => (await database.insert(bills).values({ billNumber: "BILL-TEST", vendorId: vendor.id, billDate: new Date(), subtotal: "100", total: "100", amountPaid: "0", amountDue: "100", status: "pending" }).returning())[0];
  const attachment = { path: "/objects/check-bills/00000000-0000-4000-8000-000000000001", name: "bill.pdf" };
  let standalone: Awaited<ReturnType<typeof issueCheck>>;
  await t.test("standalone creates one categorized expense and one uncleared register payment without a bill", async () => {
    standalone = await issueCheck(serviceDb, input("100", { attachment }), "admin");
    assert.equal(standalone.payment, undefined);
    assert.equal((await database.select().from(bills)).length, 0);
    assert.equal((await database.select().from(bankTransactions)).length, 1);
    const [expense] = await database.select().from(expenses);
    assert.equal(expense.bankTransactionId, standalone.transaction.id); assert.equal(expense.amount, "100.00"); assert.equal(expense.status, "paid"); assert.equal(expense.receiptUrl, attachment.path);
    assert.equal(standalone.transaction.checkDetails?.attachment?.name, "bill.pdf"); assert.equal(standalone.transaction.isCleared, false); assert.equal(standalone.transaction.isReconciled, false);
    const [updated] = await database.select().from(bankAccounts); assert.equal(Number(updated.currentBalance), 900); assert.equal(updated.nextCheckNumber, 101);
  });
  await t.test("an existing bill is paid without an extra expense", async () => {
    const bill = await newBill();
    const issued = await issueCheck(serviceDb, input("101", { billId: bill.id, attachment }), "admin");
    assert.equal(issued.payment?.billId, bill.id); assert.equal(issued.payment?.bankTransactionId, issued.transaction.id);
    const [updated] = await database.select().from(bills).where(eq(bills.id, bill.id)); assert.equal(updated.status, "paid"); assert.equal(updated.amountDue, "0.00");
    assert.equal((await database.select().from(expenses)).length, 1);
    await voidCheck(serviceDb, issued.transaction.id, bank.id, "admin");
    const [restored] = await database.select().from(bills).where(eq(bills.id, bill.id)); assert.equal(restored.amountDue, "100.00"); assert.equal(restored.status, "pending");
  });
  await t.test("duplicate numbers and invalid categories cannot create another payment", async () => {
    const before = (await database.select().from(bankTransactions)).length;
    await assert.rejects(() => issueCheck(serviceDb, input("100"), "admin"), /already been used/);
    await assert.rejects(() => issueCheck(serviceDb, input("102", { accountId: 999999 }), "admin"), /expense account/);
    assert.equal((await database.select().from(bankTransactions)).length, before);
  });
  await t.test("vendor mismatch and overpayment leave the bill unchanged", async () => {
    const bill = await newBill(); const [other] = await database.insert(vendors).values({ name: "Other", isActive: true }).returning();
    await assert.rejects(() => issueCheck(serviceDb, input("102", { billId: bill.id, vendorId: other.id }), "admin"), /does not match/);
    await assert.rejects(() => issueCheck(serviceDb, input("102", { billId: bill.id, amount: "100.01" }), "admin"), /cannot exceed/);
    const [updated] = await database.select().from(bills).where(eq(bills.id, bill.id)); assert.equal(updated.amountDue, "100");
  });
  await t.test("cleared and reconciliation-assigned checks cannot be voided", async () => {
    for (const flags of [{ isCleared: true }, { reconciliationId: 42 }]) {
      await database.update(bankTransactions).set(flags).where(eq(bankTransactions.id, standalone.transaction.id));
      await assert.rejects(() => voidCheck(serviceDb, standalone.transaction.id, bank.id, "admin"), /cannot be voided/);
      await database.update(bankTransactions).set({ isCleared: false, reconciliationId: null }).where(eq(bankTransactions.id, standalone.transaction.id));
    }
  });
  await t.test("standalone void restores balance, reverses expense and preserves its attachment; repeated void is idempotent", async () => {
    const first = await voidCheck(serviceDb, standalone.transaction.id, bank.id, "admin");
    assert.equal(first.amount, "0.00"); assert.equal(first.checkDetails?.attachment?.path, attachment.path); assert.equal(first.checkDetails?.status, "void");
    const [expense] = await database.select().from(expenses); assert.equal(expense.status, "void"); assert.equal(expense.amount, "0.00");
    const [before] = await database.select().from(bankAccounts); await voidCheck(serviceDb, standalone.transaction.id, bank.id, "admin"); const [after] = await database.select().from(bankAccounts); assert.equal(after.currentBalance, before.currentBalance); assert.equal(Number(after.currentBalance), 1000);
  });
  await t.test("issued checks snapshot banking and optional signature independently of future settings", async () => {
    const signature = "data:image/png;base64,iVBORw0KGgoTEST";
    await database.update(bankAccounts).set({ checkSignature: signature }).where(eq(bankAccounts.id, bank.id));
    const signed = await issueCheck(serviceDb, input("501", { printSignature: true }), "admin");
    assert.equal(signed.transaction.checkDetails?.signature, signature);
    assert.equal(signed.transaction.checkDetails?.routingNumber, bank.routingNumber);
    assert.equal(signed.transaction.checkDetails?.accountNumber, bank.accountNumber);
    await database.update(bankAccounts).set({ checkSignature: null }).where(eq(bankAccounts.id, bank.id));
    const [saved] = await database.select().from(bankTransactions).where(eq(bankTransactions.id, signed.transaction.id));
    assert.equal(saved.checkDetails?.signature, signature);
    const unsigned = await issueCheck(serviceDb, input("502"), "admin");
    assert.equal(unsigned.transaction.checkDetails?.signature, undefined);
    await voidCheck(serviceDb, signed.transaction.id, bank.id, "admin");
    await voidCheck(serviceDb, unsigned.transaction.id, bank.id, "admin");
  });
  await t.test("repeated submissions with the same number result in only one payment", async () => {
    const results = await Promise.allSettled([issueCheck(serviceDb, input("102"), "admin"), issueCheck(serviceDb, input("102"), "admin")]);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1); assert.equal(results.filter(r => r.status === "rejected").length, 1);
  });
  await t.test("delete reverses standalone and bill checks and removes their linked records", async () => {
    for (const withBill of [false, true]) {
      const bill = withBill ? await newBill() : undefined;
      const [before] = await database.select().from(bankAccounts);
      const issued = await issueCheck(serviceDb, input(withBill ? "701" : "700", bill ? { billId: bill.id } : {}), "admin");
      await deleteCheck(serviceDb, issued.transaction.id, bank.id, "admin");
      assert.equal((await database.select().from(bankTransactions).where(eq(bankTransactions.id, issued.transaction.id))).length, 0);
      assert.equal((await database.select().from(billPayments).where(eq(billPayments.bankTransactionId, issued.transaction.id))).length, 0);
      assert.equal((await database.select().from(expenses).where(eq(expenses.bankTransactionId, issued.transaction.id))).length, 0);
      const [after] = await database.select().from(bankAccounts);
      assert.equal(Number(after.currentBalance), Number(before.currentBalance));
      if (bill) {
        const [restored] = await database.select().from(bills).where(eq(bills.id, bill.id));
        assert.equal(restored.amountDue, "100.00"); assert.equal(restored.status, "pending");
      }
      await assert.rejects(() => deleteCheck(serviceDb, issued.transaction.id, bank.id, "admin"), /not found/);
    }
  });
  await t.test("delete protects cleared, reconciled, assigned and rebilled checks", async () => {
    const { transaction } = await issueCheck(serviceDb, input("702"), "admin");
    const [before] = await database.select().from(bankAccounts);
    for (const flags of [{ isCleared: true }, { isReconciled: true }, { reconciliationId: 42 }]) {
      await database.update(bankTransactions).set(flags).where(eq(bankTransactions.id, transaction.id));
      await assert.rejects(() => deleteCheck(serviceDb, transaction.id, bank.id, "admin"), /cannot be voided or deleted/);
      await database.update(bankTransactions).set({ isCleared: false, isReconciled: false, reconciliationId: null }).where(eq(bankTransactions.id, transaction.id));
    }
    await database.update(expenses).set({ isRebilled: true }).where(eq(expenses.bankTransactionId, transaction.id));
    await assert.rejects(() => deleteCheck(serviceDb, transaction.id, bank.id, "admin"), /rebilled/);
    const [after] = await database.select().from(bankAccounts); assert.equal(after.currentBalance, before.currentBalance);
    await database.update(expenses).set({ isRebilled: false }).where(eq(expenses.bankTransactionId, transaction.id));
    await voidCheck(serviceDb, transaction.id, bank.id, "admin");
    const [voided] = await database.select().from(bankAccounts);
    await deleteCheck(serviceDb, transaction.id, bank.id, "admin");
    const [deleted] = await database.select().from(bankAccounts); assert.equal(deleted.currentBalance, voided.currentBalance);
  });
  await t.test("legacy print repair fills missing fields, keeps saved values, and synchronizes bill history without another payment", async () => {
    const bill = await newBill();
    const issued = await issueCheck(serviceDb, input("703", { billId: bill.id }), "admin");
    const legacy = { ...issued.transaction.checkDetails!, routingNumber: undefined, accountNumber: undefined, signature: undefined };
    await database.update(bankTransactions).set({ checkDetails: null }).where(eq(bankTransactions.id, issued.transaction.id));
    await database.update(billPayments).set({ checkDetails: legacy }).where(eq(billPayments.id, issued.payment!.id));
    await database.update(bankAccounts).set({ checkSignature: "saved-signature" }).where(eq(bankAccounts.id, bank.id));
    const [before] = await database.select().from(bankAccounts);
    const updated = await completeCheckPrintDetails(serviceDb, issued.transaction.id, bank.id);
    assert.equal(updated.routingNumber, bank.routingNumber); assert.equal(updated.accountNumber, bank.accountNumber); assert.equal(updated.signature, "saved-signature");
    const [payment] = await database.select().from(billPayments).where(eq(billPayments.id, issued.payment!.id));
    assert.deepEqual(payment.checkDetails, updated);
    await database.update(bankAccounts).set({ routingNumber: "111111111", checkSignature: "replacement-signature" }).where(eq(bankAccounts.id, bank.id));
    assert.deepEqual(await completeCheckPrintDetails(serviceDb, issued.transaction.id, bank.id), updated);
    const [after] = await database.select().from(bankAccounts); assert.equal(after.currentBalance, before.currentBalance);
    await voidCheck(serviceDb, issued.transaction.id, bank.id, "admin");
    await assert.rejects(() => completeCheckPrintDetails(serviceDb, issued.transaction.id, bank.id), /void check/);
    await database.update(bankAccounts).set({ routingNumber: bank.routingNumber, checkSignature: null }).where(eq(bankAccounts.id, bank.id));
  });
  await t.test("failed deletion rolls back bill, expense and bank changes together", async () => {
    const bill = await newBill();
    const issued = await issueCheck(serviceDb, input("704", { billId: bill.id }), "admin");
    const [before] = await database.select().from(bankAccounts);
    await pg.exec("CREATE FUNCTION fail_check_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected delete failure'; END $$; CREATE TRIGGER fail_check_delete BEFORE DELETE ON bank_transactions FOR EACH ROW EXECUTE FUNCTION fail_check_delete();");
    await assert.rejects(() => deleteCheck(serviceDb, issued.transaction.id, bank.id, "admin"), /injected delete failure/);
    const [savedBill] = await database.select().from(bills).where(eq(bills.id, bill.id)); assert.equal(savedBill.status, "paid");
    assert.equal((await database.select().from(billPayments).where(eq(billPayments.id, issued.payment!.id))).length, 1);
    const [after] = await database.select().from(bankAccounts); assert.equal(after.currentBalance, before.currentBalance);
    await pg.exec("DROP TRIGGER fail_check_delete ON bank_transactions; DROP FUNCTION fail_check_delete();");
  });
  await t.test("failure after register insertion rolls back the expense and bank balance", async () => {
    await pg.exec("CREATE FUNCTION fail_expense() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected expense failure'; END $$; CREATE TRIGGER fail_expense_insert BEFORE INSERT ON expenses FOR EACH ROW EXECUTE FUNCTION fail_expense();");
    const count = (await database.select().from(bankTransactions)).length; const [before] = await database.select().from(bankAccounts);
    await assert.rejects(() => issueCheck(serviceDb, input("103"), "admin"), /injected expense failure/);
    assert.equal((await database.select().from(bankTransactions)).length, count); const [after] = await database.select().from(bankAccounts); assert.equal(after.currentBalance, before.currentBalance); assert.equal(after.nextCheckNumber, before.nextCheckNumber);
  });
  await pg.close();
});
