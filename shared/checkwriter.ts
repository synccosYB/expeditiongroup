import { z } from "zod";

// Only raster PNG signatures; no executable SVG or remote URLs.
export const checkSignatureSchema = z.string().max(200000).regex(/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/, "Upload a PNG signature smaller than 150 KB");

export interface CheckDetails {
  number: string;
  date: string;
  amount: string;
  payee: string;
  payeeAddress: string;
  companyName: string;
  companyAddress: string;
  bankName: string;
  routingNumber?: string;
  accountNumber?: string;
  signature?: string;
  billNumber: string;
  memo: string;
  status: "issued" | "void";
  issuedBy: string | number;
  billId?: number;
  attachment?: { path: string; name: string };
  voidedBy?: string | number;
  voidedAt?: string;
}

export function moneyToCents(value: string): number {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) throw new Error("Enter a positive amount with at most two decimals");
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function validateCheckPayment(amount: string, total: string, paid: string): number {
  const cents = moneyToCents(amount);
  if (cents <= 0 || cents > moneyToCents(total) - moneyToCents(paid)) throw new Error("Check amount must be positive and cannot exceed the unpaid bill balance");
  return cents;
}

export function amountInWords(amount: string): string {
  const cents = moneyToCents(amount);
  const small = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const words = (n: number): string => {
    if (n < 20) return small[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + words(n % 10) : "");
    for (const [size, label] of [[1000000, "Million"], [1000, "Thousand"], [100, "Hundred"]] as const) {
      if (n >= size) return words(Math.floor(n / size)) + " " + label + (n % size ? " " + words(n % size) : "");
    }
    return "";
  };
  return `${words(Math.floor(cents / 100))} and ${String(cents % 100).padStart(2, "0")}/100 Dollars`;
}

export const checkRequestSchema = z.object({
  bankAccountId: z.number().int().positive(),
  amount: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Invalid check date"),
  number: z.string().regex(/^[1-9]\d{0,8}$/),
  memo: z.string().max(150).default(""),
  billId: z.number().int().positive().optional(),
  vendorId: z.number().int().positive().optional(),
  payee: z.string().trim().max(255).optional(),
  payeeAddress: z.string().trim().max(500).optional(),
  accountId: z.number().int().positive().optional(),
  printSignature: z.boolean().default(false),
  attachment: z.object({ path: z.string().regex(/^\/objects\/check-bills\/[a-f0-9-]{36}$/), name: z.string().trim().min(1).max(255) }).optional(),
}).superRefine((value, ctx) => {
  if (!value.billId && !value.vendorId && !value.payee) ctx.addIssue({ code: "custom", message: "Select a vendor or enter a payee", path: ["payee"] });
  if (!value.billId && !value.accountId) ctx.addIssue({ code: "custom", message: "Select an expense account", path: ["accountId"] });
});
export type CheckRequest = z.infer<typeof checkRequestSchema>;
export interface CheckRecord { id: number; bankAccountId: number; amount: string; checkDetails: CheckDetails; }

export function validateCheckAttachment(contentType: string | undefined, size: number, reservedType: string): void {
  if (!["application/pdf", "image/png", "image/jpeg"].includes(contentType || "") || contentType !== reservedType || !Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024) throw new Error("Attach a PDF, JPG or PNG bill smaller than 10 MB");
}
