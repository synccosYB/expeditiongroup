import { mutateBillExpense } from "../vendor-bill-expense-service";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableConfig } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import {
  accounts,
  auditLogs,
  vendors,
  bankAccounts,
  bankTransactions,
  bills,
  billPayments,
  expenses,
  vendorCredits,
  vendorCreditApplications,
  vendorRefunds,
} from "../../shared/schema";
import {
  createVendorCredit,
  applyVendorCredit,
  refundVendorCredit,
  removeVendorCreditEntry,
} from "../vendor-credit-service";
import { mutateBillPayment } from "../vendor-bill-payment-service";
import { issueCheck, voidCheck } from "../checkwriter-service";
import { checkRequestSchema } from "../../shared/checkwriter";
import {
  vendorCreditSchema,
  creditApplicationSchema,
} from "../../shared/vendor-credits";

test("vendor credit inputs reject invalid amounts and dates", () => {
  const input = {
    vendorId: 1,
    accountId: 1,
    date: "2026-10-28",
    amount: "25.50",
    requestId: randomUUID(),
  };
  for (const amount of ["0", "-1", "1.001", "NaN", "1e3", "Infinity"])
    assert.equal(
      vendorCreditSchema.safeParse({ ...input, amount }).success,
      false,
    );
  for (const date of ["2026-02-30", "2026-13-01", "garbage"])
    assert.equal(
      vendorCreditSchema.safeParse({ ...input, date }).success,
      false,
    );
  assert.equal(vendorCreditSchema.safeParse(input).success, true);
});

test("vendor credit PostgreSQL lifecycle and integration", async (t) => {
  const pg = new PGlite();
  const database = drizzle(pg);
  await pg.exec(
    "CREATE TABLE users(id varchar PRIMARY KEY); INSERT INTO users VALUES ('admin'); CREATE TYPE bill_status AS ENUM ('draft','pending','partial','paid','void')",
  );
  for (const table of [
    accounts,
    vendors,
    bankAccounts,
    bankTransactions,
    bills,
    billPayments,
    expenses,
    auditLogs,
  ]) {
    const config = getTableConfig(table);
    await pg.exec(
      `CREATE TABLE "${config.name}" (${config.columns
        .filter((c) => c.name !== "amount_credited")
        .map(
          (c) =>
            `"${c.name}" ${c.primary ? "serial primary key" : (c.enumValues ? "text" : c.getSQLType()) + (c.notNull ? " not null" : "")} ${c.primary ? "" : typeof c.default === "boolean" ? "default " + c.default : typeof c.default === "string" ? "default '" + c.default + "'" : ""}`,
        )
        .join(",")})`,
    );
  }
  const migration = await readFile(
    new URL("../../migrations/20261028_vendor_credits.sql", import.meta.url),
    "utf8",
  );
  await pg.exec(migration);
  await pg.exec(migration); // migration is safe to rerun
  const serviceDb = database as unknown as Parameters<
    typeof createVendorCredit
  >[0];
  const [category] = await database
    .insert(accounts)
    .values({
      code: "5000",
      name: "Services",
      accountType: "expense",
      isActive: true,
    })
    .returning();
  const [income] = await database
    .insert(accounts)
    .values({
      code: "4000",
      name: "Income",
      accountType: "revenue",
      isActive: true,
    })
    .returning();
  const [vendor] = await database
    .insert(vendors)
    .values({ name: "Vendor A", isActive: true })
    .returning();
  const [otherVendor] = await database
    .insert(vendors)
    .values({ name: "Vendor B", isActive: true })
    .returning();
  const [bank] = await database
    .insert(bankAccounts)
    .values({
      name: "Checking",
      accountType: "checking",
      currentBalance: "1000",
      isActive: true,
      accountNumber: "123456789",
      routingNumber: "021000021",
      checkCompanyName: "Test",
      checkCompanyAddress: "Test address",
      nextCheckNumber: 1,
    })
    .returning();
  const [card] = await database
    .insert(bankAccounts)
    .values({
      name: "Credit card",
      accountType: "credit_card",
      currentBalance: "500",
      isActive: true,
    })
    .returning();
  const create = (amount: string, extras = {}) =>
    createVendorCredit(
      serviceDb,
      vendorCreditSchema.parse({
        vendorId: vendor.id,
        accountId: category.id,
        date: "2026-10-20",
        amount,
        requestId: randomUUID(),
        ...extras,
      }),
      "admin",
    );
  const newBill = async (extras = {}) =>
    (
      await database
        .insert(bills)
        .values({
          billNumber: randomUUID(),
          vendorId: vendor.id,
          billDate: new Date("2026-10-21T12:00:00"),
          subtotal: "100",
          total: "100",
          amountPaid: "0",
          amountDue: "100",
          status: "pending",
          ...extras,
        })
        .returning()
    )[0];
  const apply = (
    creditId: number,
    billId: number,
    amount: string,
    extras = {},
  ) =>
    applyVendorCredit(
      serviceDb,
      creditId,
      creditApplicationSchema.parse({
        billId,
        amount,
        date: "2026-10-28",
        requestId: randomUUID(),
        ...extras,
      }),
      "admin",
    );
  const refund = (
    creditId: number,
    bankAccountId: number,
    amount: string,
    extras = {},
  ) =>
    refundVendorCredit(
      serviceDb,
      creditId,
      {
        bankAccountId,
        amount,
        date: "2026-10-28",
        reference: "returned",
        requestId: randomUUID(),
        ...extras,
      },
      "admin",
    );
  await t.test(
    "credit creation posts no cash and duplicate requests return the same credit",
    async () => {
      const requestId = randomUUID();
      const first = await create("100", { requestId });
      const second = await create("100", { requestId });
      assert.equal(first.id, second.id);
      assert.equal((await database.select().from(bankTransactions)).length, 0);
      await assert.rejects(
        create("10", { accountId: income.id }),
        /expense category/,
      );
      await assert.rejects(create("10", { vendorId: 999999 }), /active vendor/);
    },
  );
  await t.test(
    "partial application, cash payment and reversal preserve separate balances",
    async () => {
      const credit = await create("80");
      const bill = await newBill();
      const application = await apply(credit.id, bill.id, "30");
      let [saved] = await database
        .select()
        .from(bills)
        .where(eq(bills.id, bill.id));
      assert.equal(Number(saved.amountDue), 70);
      assert.equal(Number(saved.amountCredited), 30);
      assert.equal(Number(saved.amountPaid), 0);
      const payment = await mutateBillPayment(serviceDb, "create", bill.id, {
        bankAccountId: bank.id,
        amount: "70",
        paymentDate: "2026-10-28",
        paymentMethod: "cash",
      });
      [saved] = await database
        .select()
        .from(bills)
        .where(eq(bills.id, bill.id));
      assert.equal(saved.status, "paid");
      assert.equal(Number(saved.amountDue), 0);
      assert.ok("id" in payment);
      await mutateBillPayment(serviceDb, "update", payment.id, {
        amount: "60",
      });
      [saved] = await database
        .select()
        .from(bills)
        .where(eq(bills.id, bill.id));
      assert.equal(Number(saved.amountDue), 10);
      await assert.rejects(
        mutateBillPayment(serviceDb, "update", payment.id, { amount: "71" }),
        /unpaid bill balance/,
      );
      await mutateBillPayment(serviceDb, "delete", payment.id);
      [saved] = await database
        .select()
        .from(bills)
        .where(eq(bills.id, bill.id));
      assert.equal(Number(saved.amountDue), 70);
      await removeVendorCreditEntry(
        serviceDb,
        credit.id,
        "application",
        application.id,
        "admin",
      );
      [saved] = await database
        .select()
        .from(bills)
        .where(eq(bills.id, bill.id));
      assert.equal(Number(saved.amountDue), 100);
      assert.equal(Number(saved.amountCredited), 0);
      assert.equal(saved.status, "pending");
    },
  );
  await t.test(
    "wrong vendors, excessive amounts, draft bills and backdating leave no partial records",
    async () => {
      const credit = await create("30");
      const bill = await newBill();
      await assert.rejects(
        apply(credit.id, bill.id, "31"),
        /available vendor credit/,
      );
      await assert.rejects(
        apply(
          credit.id,
          (await newBill({ vendorId: otherVendor.id })).id,
          "10",
        ),
        /this vendor/,
      );
      await assert.rejects(
        apply(credit.id, (await newBill({ status: "void" })).id, "10"),
        /open bill/,
      );
      await assert.rejects(
        apply(credit.id, bill.id, "10", { date: "2026-10-19" }),
        /credit date/,
      );
      await assert.rejects(
        apply(credit.id, bill.id, "10", { date: "2026-10-20" }),
        /bill date/,
      );
      assert.equal(
        (
          await database
            .select()
            .from(vendorCreditApplications)
            .where(eq(vendorCreditApplications.creditId, credit.id))
        ).length,
        0,
      );
    },
  );
  await t.test(
    "refunds increase checking, reduce card liability, support partial amounts and reject duplicates",
    async () => {
      const credit = await create("100");
      const requestId = randomUUID();
      const first = await refund(credit.id, bank.id, "40", { requestId });
      const repeated = await refund(credit.id, bank.id, "40", { requestId });
      assert.equal(first.id, repeated.id);
      const second = await refund(credit.id, card.id, "60");
      let [savedBank] = await database
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.id, bank.id));
      let [savedCard] = await database
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.id, card.id));
      assert.equal(Number(savedBank.currentBalance), 1040);
      assert.equal(Number(savedCard.currentBalance), 440);
      const [transaction] = await database
        .select()
        .from(bankTransactions)
        .where(eq(bankTransactions.id, first.bankTransactionId));
      assert.equal(transaction.transactionType, "refund");
      assert.equal(transaction.vendorId, vendor.id);
      assert.equal(transaction.isCleared, false);
      await assert.rejects(
        refund(credit.id, bank.id, "0.01"),
        /available vendor credit/,
      );
      await assert.rejects(
        removeVendorCreditEntry(
          serviceDb,
          credit.id,
          "credit",
          credit.id,
          "admin",
        ),
        /Reverse applications/,
      );
      await database
        .update(bankTransactions)
        .set({ isReconciled: true })
        .where(eq(bankTransactions.id, transaction.id));
      await assert.rejects(
        removeVendorCreditEntry(
          serviceDb,
          credit.id,
          "refund",
          first.id,
          "admin",
        ),
        /reconciled/,
      );
      await database
        .update(bankTransactions)
        .set({ isReconciled: false })
        .where(eq(bankTransactions.id, transaction.id));
      await removeVendorCreditEntry(
        serviceDb,
        credit.id,
        "refund",
        first.id,
        "admin",
      );
      await removeVendorCreditEntry(
        serviceDb,
        credit.id,
        "refund",
        second.id,
        "admin",
      );
      [savedBank] = await database
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.id, bank.id));
      [savedCard] = await database
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.id, card.id));
      assert.equal(Number(savedBank.currentBalance), 1000);
      assert.equal(Number(savedCard.currentBalance), 500);
      await removeVendorCreditEntry(
        serviceDb,
        credit.id,
        "credit",
        credit.id,
        "admin",
      );
      assert.ok(
        (await database.select().from(auditLogs)).some(
          (a) => a.entityType === "vendor_refund" && a.action === "delete",
        ),
      );
    },
  );
  await t.test(
    "a credit can be split between bills and a refund, with idempotent applications",
    async () => {
      const credit = await create("100"),
        bill1 = await newBill(),
        bill2 = await newBill();
      const requestId = randomUUID();
      const first = await apply(credit.id, bill1.id, "30", { requestId });
      const repeated = await apply(credit.id, bill1.id, "30", { requestId });
      assert.equal(first.id, repeated.id);
      await apply(credit.id, bill2.id, "40");
      await refund(credit.id, bank.id, "30");
      await assert.rejects(
        apply(credit.id, bill2.id, "0.01"),
        /available vendor credit/,
      );
      await assert.rejects(
        pg.exec(`DELETE FROM bills WHERE id=${bill1.id}`),
        /foreign key/,
      );
      await assert.rejects(
        pg.exec(
          `UPDATE bills SET vendor_id=${otherVendor.id} WHERE id=${bill1.id}`,
        ),
        /Reverse vendor credit/,
      );
      await pg.exec(
        `UPDATE bills SET amount_paid='10', amount_due='90' WHERE id=${bill1.id}`,
      );
      const [saved] = await database
        .select()
        .from(bills)
        .where(eq(bills.id, bill1.id));
      assert.equal(Number(saved.amountDue), 60);
    },
  );
  await t.test(
    "checkwriter respects credits when issuing and voiding checks",
    async () => {
      const credit = await create("20"),
        bill = await newBill();
      await apply(credit.id, bill.id, "20");
      const input = (amount: string) =>
        checkRequestSchema.parse({
          bankAccountId: bank.id,
          vendorId: vendor.id,
          billId: bill.id,
          number: "900",
          amount,
          date: "2026-10-28",
          memo: "Balance",
        });
      await assert.rejects(
        issueCheck(serviceDb, input("81"), "admin"),
        /unpaid bill balance/,
      );
      const issued = await issueCheck(serviceDb, input("80"), "admin");
      let [saved] = await database
        .select()
        .from(bills)
        .where(eq(bills.id, bill.id));
      assert.equal(Number(saved.amountDue), 0);
      await voidCheck(serviceDb, issued.transaction.id, bank.id, "admin");
      [saved] = await database
        .select()
        .from(bills)
        .where(eq(bills.id, bill.id));
      assert.equal(Number(saved.amountDue), 80);
      assert.equal(saved.status, "partial");
    },
  );
  await t.test(
    "competing submissions cannot consume the same balance twice",
    async () => {
      const credit = await create("50"),
        bill = await newBill();
      const results = await Promise.allSettled([
        apply(credit.id, bill.id, "50"),
        refund(credit.id, bank.id, "50"),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      const another = await create("100"),
        anotherBill = await newBill();
      const competing = await Promise.allSettled([
        apply(another.id, anotherBill.id, "100"),
        mutateBillPayment(serviceDb, "create", anotherBill.id, {
          bankAccountId: bank.id,
          amount: "100",
          paymentDate: "2026-10-28",
        }),
      ]);
      assert.equal(competing.filter((r) => r.status === "fulfilled").length, 1);
    },
  );
  await t.test(
    "Expenses Pay Bill honors credits and rolls back excessive payments",
    async () => {
      const credit = await create("25"),
        bill = await newBill();
      await apply(credit.id, bill.id, "25");
      const values = {
        vendorId: vendor.id,
        bankAccountId: bank.id,
        accountId: category.id,
        billId: bill.id,
        paymentType: "pay_bill" as const,
        expenseDate: new Date("2026-10-28T12:00:00"),
        amount: "75",
        createdByUserId: "admin",
      };
      const before = (await database.select().from(bankTransactions)).length;
      await assert.rejects(
        mutateBillExpense(serviceDb, "create", null, {
          ...values,
          amount: "76",
        }),
        /unpaid bill balance/,
      );
      assert.equal(
        (await database.select().from(bankTransactions)).length,
        before,
      );
      const expense = await mutateBillExpense(
        serviceDb,
        "create",
        null,
        values,
      );
      assert.ok("id" in expense);
      let [saved] = await database
        .select()
        .from(bills)
        .where(eq(bills.id, bill.id));
      assert.equal(Number(saved.amountDue), 0);
      assert.equal(Number(saved.amountPaid), 75);
      await mutateBillExpense(serviceDb, "update", expense.id, {
        amount: "50",
      });
      [saved] = await database
        .select()
        .from(bills)
        .where(eq(bills.id, bill.id));
      assert.equal(Number(saved.amountDue), 25);
      await assert.rejects(
        mutateBillExpense(serviceDb, "update", expense.id, { amount: "76" }),
        /unpaid bill balance/,
      );
      const [unchanged] = await database
        .select()
        .from(expenses)
        .where(eq(expenses.id, expense.id));
      assert.equal(unchanged.amount, "50.00");
      await mutateBillExpense(serviceDb, "delete", expense.id);
      [saved] = await database
        .select()
        .from(bills)
        .where(eq(bills.id, bill.id));
      assert.equal(Number(saved.amountDue), 75);
      assert.equal(Number(saved.amountPaid), 0);
      assert.equal(saved.status, "partial");
    },
  );
  await t.test(
    "editing a legacy expense can move its payment between bills atomically",
    async () => {
      const bill1 = await newBill(),
        bill2 = await newBill();
      const expense = await mutateBillExpense(serviceDb, "create", null, {
        vendorId: vendor.id,
        bankAccountId: bank.id,
        billId: bill1.id,
        paymentType: "pay_bill",
        expenseDate: new Date("2026-10-28T12:00:00"),
        amount: "40",
      });
      assert.ok("id" in expense);
      await mutateBillExpense(serviceDb, "update", expense.id, {
        billId: bill2.id,
        bankAccountId: card.id,
      });
      const [first] = await database
          .select()
          .from(bills)
          .where(eq(bills.id, bill1.id)),
        [second] = await database
          .select()
          .from(bills)
          .where(eq(bills.id, bill2.id));
      assert.equal(Number(first.amountDue), 100);
      assert.equal(Number(second.amountDue), 60);
      await mutateBillExpense(serviceDb, "delete", expense.id);
    },
  );
  await pg.close();
});

test("credit reporting balances the ledger and honors historical application/refund dates", async () => {
  const { vendorCreditLedger, availableCreditAsOf } =
    await import("../vendor-credit-reporting");
  const credit = {
    id: 1,
    vendorId: 1,
    accountId: 5,
    creditDate: new Date("2026-10-20"),
    amount: "100.10",
    reference: "VC-1",
    memo: "Return",
    requestId: randomUUID(),
    createdByUserId: "admin",
    createdAt: new Date(),
  };
  const application = {
    id: 1,
    creditId: 1,
    billId: 1,
    applicationDate: new Date("2026-10-23"),
    amount: "30.05",
    requestId: randomUUID(),
    createdByUserId: "admin",
    createdAt: new Date(),
  };
  const refund = {
    id: 1,
    creditId: 1,
    bankTransactionId: 1,
    refundDate: new Date("2026-10-25"),
    amount: "20.01",
    reference: "R1",
    requestId: randomUUID(),
    createdByUserId: "admin",
    createdAt: new Date(),
  };
  assert.equal(
    availableCreditAsOf(
      credit,
      [application],
      [refund],
      new Date("2026-10-19"),
    ),
    0,
  );
  assert.equal(
    availableCreditAsOf(
      credit,
      [application],
      [refund],
      new Date("2026-10-21"),
    ),
    100.1,
  );
  assert.equal(
    availableCreditAsOf(
      credit,
      [application],
      [refund],
      new Date("2026-10-24"),
    ),
    70.05,
  );
  assert.equal(
    availableCreditAsOf(
      credit,
      [application],
      [refund],
      new Date("2026-10-28"),
    ),
    50.04,
  );
  const lines = vendorCreditLedger([credit], [refund], 2);
  assert.equal(lines.length, 3);
  const balance = lines.reduce((sum, l) => sum + l.debit - l.credit, 0) + 20.01; // matching bank inflow
  assert.ok(Math.abs(balance) < 0.00001);
  assert.equal(
    lines
      .filter((l) => l.accountId === 5)
      .reduce((sum, l) => sum + l.debit - l.credit, 0),
    -100.1,
  );
  assert.ok(
    Math.abs(
      lines
        .filter((l) => l.accountId === 2)
        .reduce((sum, l) => sum + l.debit - l.credit, 0) - 80.09,
    ) < 0.00001,
  );
});
