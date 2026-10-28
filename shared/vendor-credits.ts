import { z } from "zod";
export const creditMoney = z
  .string()
  .regex(
    /^\d{1,9}(\.\d{1,2})?$/,
    "Enter a positive amount with at most two decimal places",
  )
  .refine((v) => Number(v) > 0, "Amount must be greater than zero");
export const creditDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Enter a valid date");
const id = z.number().int().positive();
export const vendorCreditSchema = z.object({
  vendorId: id,
  accountId: id,
  date: creditDate,
  amount: creditMoney,
  reference: z.string().trim().max(100).default(""),
  memo: z.string().trim().max(2000).default(""),
  requestId: z.string().uuid(),
});
export const creditApplicationSchema = z.object({
  billId: id,
  date: creditDate,
  amount: creditMoney,
  requestId: z.string().uuid(),
});
export const vendorRefundSchema = z.object({
  bankAccountId: id,
  date: creditDate,
  amount: creditMoney,
  reference: z.string().trim().max(100).default(""),
  requestId: z.string().uuid(),
});
export type VendorCreditInput = z.infer<typeof vendorCreditSchema>;
export type CreditApplicationInput = z.infer<typeof creditApplicationSchema>;
export type VendorRefundInput = z.infer<typeof vendorRefundSchema>;
export interface VendorCreditView {
  id: number;
  vendorId: number;
  accountId: number;
  vendorName: string;
  accountName: string;
  creditDate: string;
  amount: string;
  reference: string | null;
  memo: string | null;
  available: string;
  applied: string;
  refunded: string;
  applications: {
    id: number;
    billId: number;
    billNumber: string;
    applicationDate: string;
    amount: string;
  }[];
  refunds: {
    id: number;
    bankTransactionId: number;
    bankAccountId: number;
    bankName: string;
    refundDate: string;
    amount: string;
    reference: string | null;
  }[];
}
