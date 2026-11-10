import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  accounts, auditLogs, clientRetainers, clientRetainerRequests, clientRetainerApplications,
  clients, invoices, payments, projects, type Invoice,
} from "@shared/schema";
import {
  billingDate, centsToDollars, retainerSettingsSchema, retainerRequestSchema, retainerReceiptSchema,
  retainerApplicationSchema, type ClientBilling, type InvoiceBalance,
} from "@shared/client-retainers";
import { getRetainerAccount, getUndepositedAccount } from "./client-retainer-ledger";
import type { db } from "./db";

type Database = Pick<typeof db, "select" | "transaction">;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Pick<Database, "select">;
type Scope = { clientId: number; projectId: number };

export class BillingConflict extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

// Existing invoices and payments store dollar values as strings.
export function storedCents(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

async function audit(
  tx: Tx, actor: string, action: "create" | "update" | "status_change",
  entityType: string, id: number, metadata: object,
) {
  await tx.insert(auditLogs).values({
    userId: actor, action, entityType, entityId: String(id), metadata, isVisibleToClient: false,
  });
}

async function lockRetainer(tx: Tx, { projectId, clientId }: Scope) {
  const [retainer] = await tx.select().from(clientRetainers)
    .where(and(eq(clientRetainers.projectId, projectId), eq(clientRetainers.clientId, clientId)))
    .for("update");
  if (!retainer) throw new BillingConflict("Set up a retainer for this client’s project first.", 404);
  return retainer;
}

async function getScopedRequest(tx: Tx, projectId: number, requestId: number) {
  // The project retainer lock serializes all request changes for this project.
  const [request] = await tx.select().from(clientRetainerRequests)
    .where(and(eq(clientRetainerRequests.projectId, projectId), eq(clientRetainerRequests.id, requestId)));
  if (!request) throw new BillingConflict("Retainer request not found.", 404);
  return request;
}

async function openRequest(tx: Tx, projectId: number) {
  const [request] = await tx.select({ id: clientRetainerRequests.id }).from(clientRetainerRequests)
    .where(and(eq(clientRetainerRequests.projectId, projectId), eq(clientRetainerRequests.status, "open")));
  return request;
}

async function receiptTotal(reader: Reader, requestId: number) {
  const rows = await reader.select({ amount: payments.amount }).from(payments)
    .where(and(eq(payments.retainerRequestId, requestId), isNull(payments.retainerVoidedAt)));
  return rows.reduce((sum, row) => sum + storedCents(row.amount), 0);
}

async function projectFunds(reader: Reader, projectId: number) {
  const receipts = await reader.select({ amount: payments.amount }).from(payments)
    .innerJoin(clientRetainerRequests, eq(payments.retainerRequestId, clientRetainerRequests.id))
    .where(and(eq(clientRetainerRequests.projectId, projectId), isNull(payments.retainerVoidedAt)));
  const applications = await reader.select({ amount: clientRetainerApplications.amountCents })
    .from(clientRetainerApplications)
    .where(and(eq(clientRetainerApplications.projectId, projectId), isNull(clientRetainerApplications.reversedAt)));
  const received = receipts.reduce((sum, row) => sum + storedCents(row.amount), 0);
  const applied = applications.reduce((sum, row) => sum + row.amount, 0);
  return { received, held: received - applied };
}

async function requirePostingAccounts(tx: Tx, offset: "undeposited" | "receivable") {
  const chart = await tx.select().from(accounts).orderBy(asc(accounts.id));
  if (!getRetainerAccount(chart)?.isActive)
    throw new BillingConflict("Set up the Client Retainers liability account before posting.");
  if (offset === "undeposited" && !getUndepositedAccount(chart))
    throw new BillingConflict("Set up an active Undeposited Funds asset account before recording a receipt.");
  if (offset === "receivable" && !chart.some((account) =>
    account.isActive !== false && account.accountType === "asset" && account.accountSubtype === "accounts_receivable"))
    throw new BillingConflict("Set up an active Accounts Receivable asset account before applying a retainer.");
}

export async function saveRetainerSettings(database: Database, scope: Scope, raw: unknown, actor: string) {
  const { target, threshold } = retainerSettingsSchema.parse(raw);
  return database.transaction(async (tx) => {
    const [project] = await tx.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, scope.projectId), eq(projects.clientId, scope.clientId))).for("update");
    if (!project) throw new BillingConflict("Project not found for this client.", 404);
    const settings = { ...scope, targetCents: target, thresholdCents: threshold };
    await tx.insert(clientRetainers).values(settings).onConflictDoUpdate({
      target: clientRetainers.projectId, set: { targetCents: target, thresholdCents: threshold },
    });
    await audit(tx, actor, "update", "client_retainer", scope.projectId, settings);
    return settings;
  });
}

export async function createRetainerRequest(database: Database, scope: Scope, raw: unknown, actor: string) {
  const input = retainerRequestSchema.parse(raw);
  return database.transaction(async (tx) => {
    await lockRetainer(tx, scope);
    const [existing] = await tx.select().from(clientRetainerRequests).where(and(
      eq(clientRetainerRequests.projectId, scope.projectId), eq(clientRetainerRequests.operationId, input.operationId),
    ));
    if (existing) {
      if (existing.amountCents !== input.amount || existing.dueDate !== input.dueDate || existing.note !== input.note)
        throw new BillingConflict("This request was already saved with different details.");
      return existing;
    }
    if (await openRequest(tx, scope.projectId))
      throw new BillingConflict("This project already has an open retainer request.");
    const { received } = await projectFunds(tx, scope.projectId);
    const [request] = await tx.insert(clientRetainerRequests).values({
      projectId: scope.projectId, kind: received > 0 ? "replenishment" : "initial", amountCents: input.amount,
      dueDate: input.dueDate, note: input.note, operationId: input.operationId, createdByUserId: actor,
    }).returning();
    await audit(tx, actor, "create", "client_retainer_request", request.id, request);
    return request;
  });
}

export async function cancelRetainerRequest(database: Database, scope: Scope, requestId: number, actor: string) {
  await database.transaction(async (tx) => {
    await lockRetainer(tx, scope);
    const request = await getScopedRequest(tx, scope.projectId, requestId);
    if (request.status === "cancelled") return;
    if (request.status === "paid") throw new BillingConflict("This request has been fully funded.");
    await tx.update(clientRetainerRequests).set({ status: "cancelled" }).where(eq(clientRetainerRequests.id, requestId));
    await audit(tx, actor, "status_change", "client_retainer_request", requestId, { status: "cancelled" });
  });
}

export async function recordRetainerReceipt(
  database: Database, scope: Scope, requestId: number, raw: unknown, actor: string,
) {
  const input = retainerReceiptSchema.parse(raw);
  if (input.paymentDate > billingDate()) throw new BillingConflict("Payment date cannot be in the future.", 400);
  const paymentDate = new Date(input.paymentDate + "T12:00:00Z");
  return database.transaction(async (tx) => {
    await lockRetainer(tx, scope);
    const request = await getScopedRequest(tx, scope.projectId, requestId);
    const [existing] = await tx.select().from(payments).where(and(
      eq(payments.retainerRequestId, requestId), eq(payments.retainerReceiptKey, input.operationId),
    ));
    if (existing) {
      if (storedCents(existing.amount) !== input.amount || existing.paymentDate.getTime() !== paymentDate.getTime()
        || existing.paymentMethod !== input.paymentMethod || existing.reference !== input.reference)
        throw new BillingConflict("This receipt was already saved with different details.");
      return existing;
    }
    if (request.status !== "open") throw new BillingConflict("This retainer request is closed.");
    const remaining = request.amountCents - await receiptTotal(tx, request.id);
    if (input.amount > remaining) throw new BillingConflict("Receipt exceeds the remaining request amount.");
    await requirePostingAccounts(tx, "undeposited");
    const [receipt] = await tx.insert(payments).values({
      clientId: scope.clientId, retainerRequestId: request.id, retainerReceiptKey: input.operationId,
      paymentNumber: `RET-${request.id}-${input.operationId.slice(0, 8).toUpperCase()}`,
      paymentDate, paymentMethod: input.paymentMethod, amount: centsToDollars(input.amount), reference: input.reference,
      memo: `Client retainer request #${request.id}`, createdByUserId: actor, isDeposited: false,
    }).returning();
    if (input.amount === remaining)
      await tx.update(clientRetainerRequests).set({ status: "paid" }).where(eq(clientRetainerRequests.id, request.id));
    await audit(tx, actor, "create", "client_retainer_receipt", receipt.id, receipt);
    return receipt;
  });
}

export async function voidRetainerReceipt(database: Database, scope: Scope, paymentId: number, actor: string) {
  await database.transaction(async (tx) => {
    await lockRetainer(tx, scope);
    const [receipt] = await tx.select().from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.clientId, scope.clientId))).for("update");
    if (!receipt?.retainerRequestId) throw new BillingConflict("Retainer receipt not found.", 404);
    const request = await getScopedRequest(tx, scope.projectId, receipt.retainerRequestId);
    if (receipt.retainerVoidedAt) return;
    if (receipt.isDeposited || receipt.depositId)
      throw new BillingConflict("Deposited receipts must be reviewed in Deposits before they can be voided.");
    const { held } = await projectFunds(tx, scope.projectId);
    if (storedCents(receipt.amount) > held)
      throw new BillingConflict("Reverse the necessary invoice applications before voiding this receipt.");
    if (request.status === "paid" && await openRequest(tx, scope.projectId))
      throw new BillingConflict("Cancel the current open request before reopening this one.");
    const now = new Date();
    await tx.update(payments).set({ retainerVoidedAt: now, retainerVoidedByUserId: actor, updatedAt: now })
      .where(eq(payments.id, paymentId));
    if (request.status === "paid")
      await tx.update(clientRetainerRequests).set({ status: "open" }).where(eq(clientRetainerRequests.id, request.id));
    await audit(tx, actor, "status_change", "client_retainer_receipt", paymentId, { voidedAt: now });
  });
}

export async function lockInvoice(tx: Tx, invoiceId: number) {
  const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for("update");
  return invoice;
}

export async function invoiceSettlement(reader: Reader, invoiceId: number) {
  const cash = await reader.select({ amount: payments.amount }).from(payments).where(eq(payments.invoiceId, invoiceId));
  const applications = await reader.select().from(clientRetainerApplications)
    .where(eq(clientRetainerApplications.invoiceId, invoiceId)).orderBy(asc(clientRetainerApplications.id));
  const cashPaidCents = cash.reduce((sum, row) => sum + storedCents(row.amount), 0);
  const activeApplications = applications.filter((row) => !row.reversedAt);
  const appliedCents = activeApplications.reduce((sum, row) => sum + row.amountCents, 0);
  return { cashPaidCents, appliedCents, settledCents: cashPaidCents + appliedCents, applications, activeApplications };
}

export async function getInvoiceBalance(database: Database, invoice: Invoice, staff = false): Promise<InvoiceBalance> {
  return database.transaction(async (tx) => {
    const { cashPaidCents, appliedCents, settledCents, activeApplications } = await invoiceSettlement(tx, invoice.id);
    const total = storedCents(invoice.total);
    let retainerAvailableCents = 0;
    if (staff && invoice.status === "sent" && invoice.projectId && invoice.clientId) {
      const [retainer] = await tx.select({ projectId: clientRetainers.projectId }).from(clientRetainers)
        .where(and(eq(clientRetainers.projectId, invoice.projectId), eq(clientRetainers.clientId, invoice.clientId)));
      if (retainer) retainerAvailableCents = (await projectFunds(tx, retainer.projectId)).held;
    }
    return {
      total: total / 100, totalPaid: settledCents / 100, cashPaid: cashPaidCents / 100,
      retainerApplied: appliedCents / 100, remainingBalance: Math.max(0, total - settledCents) / 100,
      retainerApplications: activeApplications.map((row) => ({
        id: row.id, amountCents: row.amountCents, appliedAt: row.appliedAt.toISOString(),
      })),
      retainerAvailableCents,
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function syncSettledInvoice(
  tx: Tx, invoice: Invoice, settledCents: number, now: Date,
) {
  if (invoice.status !== "sent" && invoice.status !== "paid") return;
  const status = settledCents >= storedCents(invoice.total) ? "paid" : "sent";
  if (status !== invoice.status) {
    await tx.update(invoices).set({ status, paidAt: status === "paid" ? now : null, updatedAt: now })
      .where(eq(invoices.id, invoice.id));
  }
}

export async function applyRetainer(database: Database, scope: Scope, raw: unknown, actor: string) {
  const input = retainerApplicationSchema.parse(raw);
  return database.transaction(async (tx) => {
    await lockRetainer(tx, scope);
    const [existing] = await tx.select().from(clientRetainerApplications).where(and(
      eq(clientRetainerApplications.projectId, scope.projectId),
      eq(clientRetainerApplications.operationId, input.operationId),
    ));
    if (existing) {
      if (existing.invoiceId !== input.invoiceId || existing.amountCents !== input.amount)
        throw new BillingConflict("This application was already saved with different details.");
      return existing;
    }
    const invoice = await lockInvoice(tx, input.invoiceId);
    if (!invoice || invoice.clientId !== scope.clientId || invoice.projectId !== scope.projectId)
      throw new BillingConflict("Select an invoice for this client and project.", 404);
    if (invoice.status !== "sent" || (invoice.createdAt && billingDate(invoice.createdAt) > billingDate()))
      throw new BillingConflict("Retainers can only be applied to an issued, unpaid invoice.");
    const { settledCents } = await invoiceSettlement(tx, invoice.id);
    if (input.amount > storedCents(invoice.total) - settledCents)
      throw new BillingConflict("Application exceeds the invoice balance.");
    const { held } = await projectFunds(tx, scope.projectId);
    if (input.amount > held) throw new BillingConflict("Application exceeds the available retainer.");
    await requirePostingAccounts(tx, "receivable");
    const now = new Date();
    const [application] = await tx.insert(clientRetainerApplications).values({
      projectId: scope.projectId, invoiceId: invoice.id, amountCents: input.amount, appliedAt: now,
      operationId: input.operationId, createdByUserId: actor,
    }).returning();
    await syncSettledInvoice(tx, invoice, settledCents + input.amount, now);
    await audit(tx, actor, "create", "client_retainer_application", application.id, application);
    return application;
  });
}

export async function reverseRetainerApplication(
  database: Database, scope: Scope, applicationId: number, actor: string,
) {
  await database.transaction(async (tx) => {
    await lockRetainer(tx, scope);
    const [application] = await tx.select().from(clientRetainerApplications).where(and(
      eq(clientRetainerApplications.projectId, scope.projectId), eq(clientRetainerApplications.id, applicationId),
    ));
    if (!application) throw new BillingConflict("Retainer application not found.", 404);
    if (application.reversedAt) return;
    const invoice = await lockInvoice(tx, application.invoiceId);
    if (!invoice) throw new BillingConflict("Invoice not found.", 404);
    const now = new Date();
    await tx.update(clientRetainerApplications).set({ reversedAt: now, reversedByUserId: actor })
      .where(eq(clientRetainerApplications.id, application.id));
    const { settledCents } = await invoiceSettlement(tx, invoice.id);
    await syncSettledInvoice(tx, invoice, settledCents, now);
    await audit(tx, actor, "status_change", "client_retainer_application", applicationId, { reversedAt: now });
  });
}

function invoiceAmounts(
  invoiceRows: Pick<Invoice, "id" | "total">[],
  cash: { invoiceId: number | null; amount: string }[],
  applications: { invoiceId: number; amountCents: number; reversedAt: Date | null }[],
) {
  const cashByInvoice = new Map<number, number>();
  for (const payment of cash) {
    if (payment.invoiceId !== null) cashByInvoice.set(payment.invoiceId,
      (cashByInvoice.get(payment.invoiceId) ?? 0) + storedCents(payment.amount));
  }
  const appliedByInvoice = new Map<number, number>();
  for (const application of applications) {
    if (!application.reversedAt) appliedByInvoice.set(application.invoiceId,
      (appliedByInvoice.get(application.invoiceId) ?? 0) + application.amountCents);
  }
  return new Map(invoiceRows.map((invoice) => {
    const retainerAppliedCents = appliedByInvoice.get(invoice.id) ?? 0;
    return [invoice.id, {
      balanceCents: Math.max(0, storedCents(invoice.total) - (cashByInvoice.get(invoice.id) ?? 0) - retainerAppliedCents),
      retainerAppliedCents,
    }];
  }));
}

export async function getInvoiceAmounts(database: Database, invoiceRows: Pick<Invoice, "id" | "total">[]) {
  if (!invoiceRows.length) return invoiceAmounts([], [], []);
  const ids = invoiceRows.map((invoice) => invoice.id);
  return database.transaction(async (tx) => {
    const cash = await tx.select({ invoiceId: payments.invoiceId, amount: payments.amount })
      .from(payments).where(inArray(payments.invoiceId, ids));
    const applications = await tx.select({
      invoiceId: clientRetainerApplications.invoiceId, amountCents: clientRetainerApplications.amountCents,
      reversedAt: clientRetainerApplications.reversedAt,
    }).from(clientRetainerApplications).where(inArray(clientRetainerApplications.invoiceId, ids));
    return invoiceAmounts(invoiceRows, cash, applications);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function getClientBilling(database: Database, clientId: number): Promise<ClientBilling> {
  return database.transaction(async (tx) => {
    const [client] = await tx.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId));
    if (!client) throw new BillingConflict("Client not found.", 404);
    const jobs = await tx.select({ id: projects.id, name: projects.name, settings: clientRetainers })
      .from(projects).leftJoin(clientRetainers, eq(projects.id, clientRetainers.projectId))
      .where(eq(projects.clientId, clientId)).orderBy(asc(projects.name));
    const requests = await tx.select({ request: clientRetainerRequests }).from(clientRetainerRequests)
      .innerJoin(clientRetainers, eq(clientRetainers.projectId, clientRetainerRequests.projectId))
      .where(eq(clientRetainers.clientId, clientId)).orderBy(desc(clientRetainerRequests.id));
    const receiptRows = await tx.select().from(payments)
      .where(eq(payments.clientId, clientId)).orderBy(desc(payments.paymentDate), desc(payments.id));
    const applications = await tx.select({ application: clientRetainerApplications, invoiceNumber: invoices.invoiceNumber })
      .from(clientRetainerApplications)
      .innerJoin(clientRetainers, eq(clientRetainers.projectId, clientRetainerApplications.projectId))
      .innerJoin(invoices, eq(invoices.id, clientRetainerApplications.invoiceId))
      .where(eq(clientRetainers.clientId, clientId)).orderBy(desc(clientRetainerApplications.id));
    const clientInvoices = await tx.select().from(invoices).where(eq(invoices.clientId, clientId));
    const cashOnInvoices = await tx.select({ invoiceId: invoices.id, amount: payments.amount }).from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id)).where(eq(invoices.clientId, clientId));

    const invoiceBalances = invoiceAmounts(clientInvoices, cashOnInvoices, applications.map((row) => row.application));
    const receivedByRequest = new Map<number, number>();
    for (const receipt of receiptRows) {
      if (receipt.retainerRequestId && !receipt.retainerVoidedAt) receivedByRequest.set(receipt.retainerRequestId,
        (receivedByRequest.get(receipt.retainerRequestId) ?? 0) + storedCents(receipt.amount));
    }

    const invoiceRows = clientInvoices.map((invoice) => ({
      id: invoice.id, invoiceNumber: invoice.invoiceNumber, projectId: invoice.projectId, status: invoice.status,
      ...invoiceBalances.get(invoice.id)!,
    }));
    const projectRows = jobs.map(({ id, name, settings }) => {
      const jobRequests = requests.filter(({ request }) => request.projectId === id).map(({ request }) => ({
        id: request.id, kind: request.kind, status: request.status, amountCents: request.amountCents,
        receivedCents: receivedByRequest.get(request.id) ?? 0, dueDate: request.dueDate,
        note: request.note, createdAt: request.createdAt.toISOString(),
      }));
      const jobApplications = applications.filter(({ application }) => application.projectId === id)
        .map(({ application, invoiceNumber }) => ({
          id: application.id, invoiceId: application.invoiceId, invoiceNumber, amountCents: application.amountCents,
          appliedAt: application.appliedAt.toISOString(), reversedAt: application.reversedAt?.toISOString() ?? null,
        }));
      const received = jobRequests.reduce((sum, row) => sum + row.receivedCents, 0);
      const applied = jobApplications.reduce((sum, row) => sum + (row.reversedAt ? 0 : row.amountCents), 0);
      const heldCents = received - applied;
      return {
        id, name, heldCents, targetCents: settings?.targetCents ?? null, thresholdCents: settings?.thresholdCents ?? null,
        lowBalance: settings !== null && heldCents <= settings.thresholdCents,
        suggestedCents: Math.max(0, (settings?.targetCents ?? 0) - heldCents),
        requests: jobRequests, applications: jobApplications,
      };
    });
    return {
      invoicesDueCents: invoiceRows.reduce((sum, row) => sum + (row.status === "sent" ? row.balanceCents : 0), 0),
      requestedCents: projectRows.flatMap((row) => row.requests)
        .reduce((sum, row) => sum + (row.status === "open" ? row.amountCents - row.receivedCents : 0), 0),
      heldCents: projectRows.reduce((sum, row) => sum + row.heldCents, 0),
      invoices: invoiceRows, projects: projectRows,
      payments: receiptRows.map((row) => ({
        id: row.id, paymentNumber: row.paymentNumber, amountCents: storedCents(row.amount),
        paymentDate: row.paymentDate.toISOString(), paymentMethod: row.paymentMethod, reference: row.reference,
        invoiceId: row.invoiceId, retainerRequestId: row.retainerRequestId,
        retainerVoidedAt: row.retainerVoidedAt?.toISOString() ?? null, isDeposited: row.isDeposited,
      })),
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
