import { z } from "zod";
import { moneyToCents } from "./checkwriter";

export const clientRetainersAccountCode = "CLIENT-RETAINERS";

const dollars = z.string().trim().refine((value) => {
  try {
    return moneyToCents(value) <= 2_147_483_647;
  } catch {
    return false;
  }
}, "Enter a valid amount with up to two decimal places and no more than $21,474,836.47.")
  .transform(moneyToCents);
const positiveAmount = dollars.refine((cents) => cents > 0, "Amount must be greater than zero.");
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const day = new Date(value + "T12:00:00Z");
  return value >= "0001-01-01" && Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value;
}, "Enter a valid date.");
const operationId = z.string().uuid();
export const paymentMethods = ["cash", "check", "credit_card", "debit_card", "bank_transfer", "other"] as const;

export const retainerSettingsSchema = z.object({
  target: positiveAmount,
  threshold: dollars,
}).refine(({ target, threshold }) => threshold < target, {
  message: "Low-balance threshold must be less than the target.",
});

export const retainerRequestSchema = z.object({
  amount: positiveAmount,
  dueDate: dateOnly.nullable().default(null),
  note: z.string().trim().max(500).default(""),
  operationId,
});

export const retainerReceiptSchema = z.object({
  amount: positiveAmount,
  paymentDate: dateOnly,
  paymentMethod: z.enum(paymentMethods),
  reference: z.string().trim().max(100).default(""),
  operationId,
});

export const retainerApplicationSchema = z.object({
  invoiceId: z.number().int().positive(),
  amount: positiveAmount,
  operationId,
});

export function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

const businessDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
});
export function billingDate(date = new Date()) {
  return businessDate.format(date);
}

export type InvoiceBalance = {
  total: number;
  totalPaid: number;
  cashPaid: number;
  retainerApplied: number;
  remainingBalance: number;
  retainerApplications: { id: number; amountCents: number; appliedAt: string }[];
  retainerAvailableCents: number;
};

export type ClientBilling = {
  invoicesDueCents: number;
  requestedCents: number;
  heldCents: number;
  invoices: {
    id: number;
    invoiceNumber: string;
    projectId: number | null;
    status: "draft" | "sent" | "paid" | "cancelled";
    balanceCents: number;
    retainerAppliedCents: number;
  }[];
  projects: {
    id: number;
    name: string;
    targetCents: number | null;
    thresholdCents: number | null;
    heldCents: number;
    lowBalance: boolean;
    suggestedCents: number;
    requests: {
      id: number;
      kind: "initial" | "replenishment";
      status: "open" | "paid" | "cancelled";
      amountCents: number;
      receivedCents: number;
      dueDate: string | null;
      note: string | null;
      createdAt: string;
    }[];
    applications: {
      id: number;
      invoiceId: number;
      invoiceNumber: string;
      amountCents: number;
      appliedAt: string;
      reversedAt: string | null;
    }[];
  }[];
  payments: {
    id: number;
    paymentNumber: string;
    amountCents: number;
    paymentDate: string;
    paymentMethod: typeof paymentMethods[number] | null;
    reference: string | null;
    invoiceId: number | null;
    retainerRequestId: number | null;
    retainerVoidedAt: string | null;
    isDeposited: boolean | null;
  }[];
};
