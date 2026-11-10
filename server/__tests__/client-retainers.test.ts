import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableConfig } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import {
  accounts, auditLogs, bankAccounts, bankTransactions, clientRetainerApplications, clients,
  deposits, insertPaymentSchema, invoices, payments, projects,
} from "../../shared/schema";
import { billingDate, retainerRequestSchema, retainerSettingsSchema } from "../../shared/client-retainers";
import {
  applyRetainer, cancelRetainerRequest, createRetainerRequest, getClientBilling, getInvoiceBalance,
  recordRetainerReceipt, reverseRetainerApplication, saveRetainerSettings, voidRetainerReceipt,
} from "../client-retainer-service";
import { retainerLedger } from "../client-retainer-ledger";
import {
  backfillPaidInvoice, editCustomerPayment, postCustomerDeposit, recordCustomerPayments,
  removeCustomerDeposit, removeCustomerPayment, updateInvoiceAndPayment,
} from "../customer-payments";

test("retainer forms validate exact cents and calendar dates", () => {
  assert.equal(retainerSettingsSchema.parse({ target: "100.05", threshold: "20" }).target, 10005);
  assert.equal(retainerSettingsSchema.safeParse({ target: "100", threshold: "100" }).success, false);
  const request = { operationId: randomUUID(), dueDate: "2028-02-29" };
  for (const amount of ["0", "-1", "1e3", "1.001", "NaN", "21474836.48"]) {
    assert.equal(retainerRequestSchema.safeParse({ ...request, amount }).success, false, amount);
  }
  for (const dueDate of ["2026-02-29", "2026-11-31", "0000-01-01", "11/10/2026"]) {
    assert.equal(retainerRequestSchema.safeParse({ ...request, amount: "1", dueDate }).success, false, dueDate);
  }
  assert.equal(retainerRequestSchema.safeParse({ ...request, amount: "1" }).success, true);
});

test("legacy payment inputs cannot set retainer receipt fields", () => {
  const result = insertPaymentSchema.parse({
    paymentNumber: "PMT-0001", clientId: 1, paymentDate: "2026-11-10", amount: "1",
    retainerRequestId: 42, retainerReceiptKey: randomUUID(), retainerVoidedAt: new Date(),
  });
  assert.equal("retainerRequestId" in result, false);
  assert.equal("retainerVoidedAt" in result, false);
  assert.equal("retainerReceiptKey" in result, false);
});

test("PostgreSQL retainer lifecycle", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  const database = drizzle(pg);
  const serviceDb = database as unknown as Parameters<typeof saveRetainerSettings>[0];
  const actor = "test-admin";
  await pg.exec(`CREATE TABLE users (id varchar PRIMARY KEY); INSERT INTO users VALUES ('${actor}');`);
  for (const table of [accounts, auditLogs, bankAccounts, bankTransactions, clients, deposits, invoices, payments, projects]) {
    const { name, columns } = getTableConfig(table);
    const definitions = columns.filter((column) => !column.name.startsWith("retainer_")).map((column) => {
      if (column.primary) return `"${column.name}" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY`;
      const defaultValue = typeof column.default === "boolean" ? ` DEFAULT ${column.default}`
        : typeof column.default === "string" ? ` DEFAULT '${column.default}'` : "";
      return `"${column.name}" ${column.enumValues ? "text" : column.getSQLType()}${column.notNull ? " NOT NULL" : ""}${defaultValue}`;
    });
    if (name === "accounts") definitions.push("UNIQUE (code)");
    await pg.exec(`CREATE TABLE "${name}" (${definitions.join(", ")});`);
  }
  const [client] = await database.insert(clients).values({ name: "Billing test client" }).returning();
  const [otherClient] = await database.insert(clients).values({ name: "Different client" }).returning();
  const [project, sibling] = await database.insert(projects).values([
    { clientId: client.id, name: "Permit filing" }, { clientId: client.id, name: "Site review" },
  ]).returning();
  const scope = { clientId: client.id, projectId: project.id };
  const now = new Date();
  const past = new Date(now.getTime() - 3 * 86_400_000);
  const today = billingDate(now);
  const newInvoice = async (invoiceNumber: string, total: string, projectId = project.id, status = "sent" as const) => {
    const [invoice] = await database.insert(invoices).values({
      invoiceNumber, projectId, status, clientId: client.id, subtotal: total, total, createdAt: past,
    }).returning();
    return invoice;
  };
  const [existing] = await database.insert(invoices).values({
    invoiceNumber: "INV-LEGACY", clientId: client.id, subtotal: "30.00", total: "30.00",
    createdAt: past, status: "sent",
  }).returning();
  await pg.query("INSERT INTO payments (payment_number, client_id, invoice_id, amount, payment_date) VALUES ('PMT-LEGACY', $1, $2, '5.00', $3)",
    [client.id, existing.id, past]);

  const migration = await readFile(new URL("../../migrations/20261110_client_retainers.sql", import.meta.url), "utf8");
  await pg.exec(migration);
  await pg.exec(migration);
  const [liability] = await database.select().from(accounts).where(eq(accounts.code, "CLIENT-RETAINERS"));
  assert.equal(liability.accountType, "liability");
  assert.equal((await getInvoiceBalance(serviceDb, existing)).remainingBalance, 25);

  const create = (amount: string, operationId = randomUUID()) =>
    createRetainerRequest(serviceDb, scope, { amount, dueDate: today, operationId }, actor);
  const pay = (requestId: number, amount: string, operationId = randomUUID()) =>
    recordRetainerReceipt(serviceDb, scope, requestId, {
      amount, operationId, paymentDate: billingDate(past), paymentMethod: "check", reference: "1102",
    }, actor);
  const apply = (invoiceId: number, amount: string, operationId = randomUUID()) =>
    applyRetainer(serviceDb, scope, { invoiceId, amount, operationId }, actor);
  const read = () => getClientBilling(serviceDb, client.id);
  const cash = (invoiceId: number, amount: string) => ({
    invoiceId, amount, paymentNumber: "", clientId: client.id, paymentDate: now, paymentMethod: "check" as const,
  });
  const currentInvoice = async (id: number) => (await database.select().from(invoices).where(eq(invoices.id, id)))[0];
  const invoice = await newInvoice("INV-SERVICES", "75");
  const siblingInvoice = await newInvoice("INV-SIBLING", "90", sibling.id);
  const [draft] = await database.insert(invoices).values({
    invoiceNumber: "INV-DRAFT", projectId: project.id, status: "draft", clientId: client.id,
    subtotal: "40", total: "40", createdAt: past,
  }).returning();

  await assert.rejects(saveRetainerSettings(serviceDb, { ...scope, clientId: otherClient.id },
    { target: "100", threshold: "75" }, actor), /Project not found/);
  await saveRetainerSettings(serviceDb, scope, { target: "100", threshold: "75" }, actor);
  await assert.rejects(database.update(projects).set({ clientId: otherClient.id }).where(eq(projects.id, project.id)),
    /foreign key constraint/);

  const operationId = randomUUID();
  const initial = await create("100", operationId);
  assert.equal(initial.kind, "initial");
  assert.equal((await create("100", operationId)).id, initial.id);
  await assert.rejects(create("99", operationId), /already saved/);
  await assert.rejects(create("100"), /already has an open/);
  assert.equal((await read()).invoicesDueCents, 19000);
  assert.equal((await read()).requestedCents, 10000);
  assert.equal((await read()).heldCents, 0);
  await assert.rejects(pay(initial.id, "10"), /Undeposited Funds/);

  const [undeposited, ar] = await database.insert(accounts).values([
    { code: "1150", name: "Undeposited Funds", accountType: "asset", accountSubtype: "other_current_asset" },
    { code: "1200", name: "Accounts Receivable", accountType: "asset", accountSubtype: "accounts_receivable" },
  ]).returning();
  const fundingKey = randomUUID();
  const first = await pay(initial.id, "40", fundingKey);
  assert.equal(first.invoiceId, null);
  assert.equal(first.isDeposited, false);
  assert.equal((await pay(initial.id, "40", fundingKey)).id, first.id);
  assert.equal((await read()).requestedCents, 6000);
  assert.equal((await read()).heldCents, 4000);
  await assert.rejects(pay(initial.id, "60.01"), /exceeds/);
  await pay(initial.id, "60");
  assert.equal((await pay(initial.id, "40", fundingKey)).id, first.id);
  assert.equal((await read()).requestedCents, 0);
  assert.equal((await read()).heldCents, 10000);
  await assert.rejects(removeCustomerPayment(serviceDb, first.id), /Billing tab/);
  await assert.rejects(editCustomerPayment(serviceDb, first.id, { amount: "4" }), /Billing tab/);

  await assert.rejects(apply(siblingInvoice.id, "5"), /this client and project/);
  await assert.rejects(apply(draft.id, "5"), /issued, unpaid/);
  await assert.rejects(apply(invoice.id, "75.01"), /invoice balance/);
  const applicationKey = randomUUID();
  const application = await apply(invoice.id, "35", applicationKey);
  assert.equal((await apply(invoice.id, "35", applicationKey)).id, application.id);
  const partial = await getInvoiceBalance(serviceDb, await currentInvoice(invoice.id), true);
  assert.equal(partial.cashPaid, 0);
  assert.equal(partial.retainerApplied, 35);
  assert.equal(partial.remainingBalance, 40);
  assert.equal(partial.retainerAvailableCents, 6500);
  assert.equal((await getInvoiceBalance(serviceDb, invoice)).retainerAvailableCents, 0);
  const billing = await read();
  assert.equal(billing.invoicesDueCents, 15500);
  assert.equal(billing.projects[0].lowBalance, true);
  assert.equal(billing.projects[0].suggestedCents, 3500);
  await assert.rejects(updateInvoiceAndPayment(serviceDb, invoice.id, { status: "cancelled" }, actor), /Reverse the invoice/);
  await assert.rejects(updateInvoiceAndPayment(serviceDb, invoice.id, { total: "34" }, actor), /below its cash/);
  await assert.rejects(updateInvoiceAndPayment(serviceDb, invoice.id, { projectId: sibling.id }, actor), /cannot be moved/);

  const competing = await Promise.allSettled([
    recordCustomerPayments(serviceDb, [cash(invoice.id, "40")]),
    apply(invoice.id, "40"),
  ]);
  assert.equal(competing.filter(({ status }) => status === "fulfilled").length, 1);
  const [winner] = await database.select().from(payments).where(eq(payments.invoiceId, invoice.id));
  const [secondApplication] = await database.select().from(clientRetainerApplications)
    .where(eq(clientRetainerApplications.invoiceId, invoice.id));
  assert.ok(secondApplication);
  assert.equal((await currentInvoice(invoice.id)).status, "paid");
  assert.equal(await backfillPaidInvoice(serviceDb, invoice.id), false);
  if (winner) {
    await assert.rejects(editCustomerPayment(serviceDb, winner.id, { amount: "40.01" }), /exceed/);
    assert.equal(await removeCustomerPayment(serviceDb, winner.id), true);
    assert.equal((await currentInvoice(invoice.id)).status, "sent");
    await apply(invoice.id, "40");
  }
  assert.equal((await getInvoiceBalance(serviceDb, await currentInvoice(invoice.id))).remainingBalance, 0);
  assert.equal(await backfillPaidInvoice(serviceDb, invoice.id), false);
  assert.equal((await database.select().from(payments).where(eq(payments.invoiceId, invoice.id))).length, 0);

  const replenishment = await create("75");
  assert.equal(replenishment.kind, "replenishment");
  assert.equal((await read()).requestedCents, 7500);
  const partialReceipt = await pay(replenishment.id, "20");
  await cancelRetainerRequest(serviceDb, scope, replenishment.id, actor);
  assert.equal((await read()).requestedCents, 0);
  assert.equal((await read()).heldCents, 4500);

  const [cashAccount] = await database.insert(accounts).values({
    code: "1000", name: "Checking", accountType: "asset", accountSubtype: "bank",
  }).returning();
  const [bank, creditCard] = await database.insert(bankAccounts).values([
    { name: "Checking", accountType: "checking", openingBalance: "10", linkedAccountId: cashAccount.id },
    { name: "Card", accountType: "credit_card" },
  ]).returning();
  const depositData = { depositDate: now, bankAccountId: bank.id, totalAmount: "40", createdByUserId: actor };
  await assert.rejects(postCustomerDeposit(serviceDb, { ...depositData, totalAmount: "40.01" }, [first.id]), /must match/);
  await assert.rejects(postCustomerDeposit(serviceDb, { ...depositData, bankAccountId: creditCard.id }, [first.id]), /active bank or cash/);
  const posted = await postCustomerDeposit(serviceDb, depositData, [first.id]);
  assert.equal(posted.payments[0].isDeposited, true);
  await assert.rejects(postCustomerDeposit(serviceDb, depositData, [first.id]), /already deposited/);
  await assert.rejects(voidRetainerReceipt(serviceDb, scope, first.id, actor), /reviewed in Deposits/);
  assert.equal((await database.select().from(bankTransactions)).length, 1);
  assert.equal((await database.select().from(bankAccounts).where(eq(bankAccounts.id, bank.id)))[0].currentBalance, "50.00");
  await database.update(bankTransactions).set({ isReconciled: true }).where(eq(bankTransactions.id, posted.bankTransactionId!));
  await assert.rejects(removeCustomerDeposit(serviceDb, posted.id), /reconciled/);
  await database.update(bankTransactions).set({ isReconciled: false }).where(eq(bankTransactions.id, posted.bankTransactionId!));
  assert.equal(await removeCustomerDeposit(serviceDb, posted.id), true);
  assert.equal((await database.select().from(bankAccounts).where(eq(bankAccounts.id, bank.id)))[0].currentBalance, "10.00");

  await voidRetainerReceipt(serviceDb, scope, partialReceipt.id, actor);
  await voidRetainerReceipt(serviceDb, scope, partialReceipt.id, actor);
  await assert.rejects(voidRetainerReceipt(serviceDb, scope, first.id, actor), /Reverse the necessary/);
  assert.equal((await read()).heldCents, 2500);
  await reverseRetainerApplication(serviceDb, scope, application.id, actor);
  await reverseRetainerApplication(serviceDb, scope, application.id, actor);
  assert.equal((await currentInvoice(invoice.id)).status, "sent");
  assert.equal((await getInvoiceBalance(serviceDb, await currentInvoice(invoice.id))).remainingBalance, 35);

  const receiptRows = await database.select().from(payments);
  const applicationRows = await database.select().from(clientRetainerApplications);
  const lines = retainerLedger(receiptRows, applicationRows.map((row) => ({ ...row, invoiceNumber: invoice.invoiceNumber })),
    { liability: liability.id, undeposited: undeposited.id, ar: ar.id });
  const balance = (accountId: number) => lines.filter((line) => line.accountId === accountId)
    .reduce((sum, line) => sum + line.debit - line.credit, 0);
  assert.equal(balance(liability.id), -60);
  assert.equal(balance(undeposited.id), 100);
  assert.equal(balance(ar.id), -40);
  assert.equal(lines.reduce((sum, line) => sum + line.debit - line.credit, 0), 0);
  assert.ok((await database.select().from(auditLogs)).length >= 10);
  assert.equal((await getClientBilling(serviceDb, otherClient.id)).heldCents, 0);

  const before = await read();
  await assert.rejects(recordCustomerPayments(serviceDb, [cash(invoice.id, "20"), cash(siblingInvoice.id, "90.01")], true), /exceeds/);
  assert.equal((await read()).invoicesDueCents, before.invoicesDueCents, "bulk failures roll back prior allocations");
  await updateInvoiceAndPayment(serviceDb, invoice.id, { status: "paid" }, actor);
  const paid = await getInvoiceBalance(serviceDb, await currentInvoice(invoice.id));
  assert.equal(paid.cashPaid, 35);
  assert.equal(paid.retainerApplied, 40);
  assert.equal(paid.remainingBalance, 0);
});
