CREATE TYPE "public"."expense_payment_type" AS ENUM('expense', 'pay_bill', 'check', 'transfer', 'other');--> statement-breakpoint
CREATE TYPE "public"."journal_entry_status" AS ENUM('draft', 'posted', 'void');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('referral', 'website', 'cold_call', 'email', 'social_media', 'event', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'check', 'credit_card', 'debit_card', 'bank_transfer', 'other');--> statement-breakpoint
CREATE TYPE "public"."pipeline_stage" AS ENUM('lead', 'qualified', 'meeting', 'proposal', 'won', 'lost');--> statement-breakpoint
ALTER TYPE "public"."client_status" ADD VALUE 'archived';--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "deposits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"deposit_date" timestamp NOT NULL,
	"bank_account_id" integer NOT NULL,
	"bank_transaction_id" integer,
	"total_amount" varchar(20) NOT NULL,
	"memo" text,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "folder_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "folder_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"entity_type" varchar(20) NOT NULL,
	"folder_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "journal_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entry_number" varchar(50) NOT NULL,
	"entry_date" timestamp NOT NULL,
	"memo" text,
	"status" "journal_entry_status" DEFAULT 'draft',
	"total_amount" varchar(20) DEFAULT '0' NOT NULL,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "journal_entry_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "journal_entry_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"journal_entry_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"description" text,
	"debit" varchar(20) DEFAULT '0',
	"credit" varchar(20) DEFAULT '0',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"payment_number" varchar(50) NOT NULL,
	"client_id" integer NOT NULL,
	"invoice_id" integer,
	"payment_date" timestamp NOT NULL,
	"amount" varchar(20) NOT NULL,
	"payment_method" "payment_method" DEFAULT 'check',
	"reference" varchar(100),
	"memo" text,
	"is_deposited" boolean DEFAULT false,
	"deposit_id" integer,
	"deposited_at" timestamp,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_contacts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_contacts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"company" varchar(255),
	"email" varchar(255),
	"phone" varchar(50),
	"title" varchar(255),
	"source" "lead_source" DEFAULT 'other',
	"stage" "pipeline_stage" DEFAULT 'lead' NOT NULL,
	"estimated_value" varchar(20),
	"notes" text,
	"last_contacted_at" timestamp,
	"next_follow_up_at" timestamp,
	"proposal_id" integer,
	"converted_to_client_id" integer,
	"assigned_to_user_id" varchar,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "folders" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "client_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "hourly_rate" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "is_visible_to_client" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "document_url" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "associate_id" integer;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "payment_type" "expense_payment_type" DEFAULT 'expense';--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "bill_id" integer;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "receipt_url" text;--> statement-breakpoint
ALTER TABLE "folders" ADD COLUMN "associate_id" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "recipient_name" varchar(255);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "recipient_email" varchar(255);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "recipient_address" text;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_bank_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_contacts" ADD CONSTRAINT "sales_contacts_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_contacts" ADD CONSTRAINT "sales_contacts_converted_to_client_id_clients_id_fk" FOREIGN KEY ("converted_to_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_contacts" ADD CONSTRAINT "sales_contacts_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_contacts" ADD CONSTRAINT "sales_contacts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_associate_id_associates_id_fk" FOREIGN KEY ("associate_id") REFERENCES "public"."associates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_associate_id_associates_id_fk" FOREIGN KEY ("associate_id") REFERENCES "public"."associates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_code_unique" UNIQUE("code");