import { z } from "zod";

export const invoiceUpdateSchema = z.object({
  invoiceNumber: z.string().trim().min(1, "Invoice number is required").optional(),
  status: z.enum(["draft", "sent", "paid", "cancelled"]).optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  isVisibleToClient: z.boolean().optional(),
  recipientName: z.string().nullable().optional(),
  recipientEmail: z.string().nullable().optional(),
  recipientAddress: z.string().nullable().optional(),
  clientId: z.number().nullable().optional(),
  subtotal: z.string().optional(),
  total: z.string().optional(),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.string(),
    unitPrice: z.string(),
    amount: z.string(),
    isCustom: z.boolean().optional(),
    timeLogId: z.number().nullable().optional(),
    timeEntryId: z.number().nullable().optional(),
    catalogItemId: z.number().nullable().optional(),
  })).optional(),
});

export type InvoiceUpdatePayload = z.infer<typeof invoiceUpdateSchema>;
