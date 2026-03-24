ALTER TABLE "invoices" ALTER COLUMN "is_visible_to_client" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD COLUMN "last_activity_at" timestamp;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD COLUMN "linked_transaction_id" integer;--> statement-breakpoint
ALTER TABLE "bill_items" ADD COLUMN "is_rebilled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "bill_items" ADD COLUMN "rebilled_invoice_id" integer;--> statement-breakpoint
ALTER TABLE "bill_items" ADD COLUMN "rebilled_at" timestamp;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_rebilled_invoice_id_invoices_id_fk" FOREIGN KEY ("rebilled_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;