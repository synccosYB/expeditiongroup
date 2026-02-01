CREATE TYPE "public"."account_subtype" AS ENUM('cash', 'bank', 'accounts_receivable', 'other_current_asset', 'fixed_asset', 'accounts_payable', 'credit_card', 'other_current_liability', 'long_term_liability', 'owner_equity', 'retained_earnings', 'service_revenue', 'other_income', 'cost_of_goods', 'operating_expense', 'payroll_expense', 'other_expense');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('login', 'logout', 'upload', 'download', 'view', 'create', 'update', 'delete', 'status_change', 'document_uploaded', 'document_reviewed', 'document_accepted', 'document_rejected');--> statement-breakpoint
CREATE TYPE "public"."bank_account_type" AS ENUM('checking', 'savings', 'credit_card', 'cash', 'other');--> statement-breakpoint
CREATE TYPE "public"."bill_status" AS ENUM('draft', 'pending', 'partial', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('uploaded', 'under_review', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('pending', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."intake_status" AS ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'sent', 'accepted', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."service_category" AS ENUM('accounting', 'write_up', 'bookkeeping', 'cfo');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('deposit', 'withdrawal', 'transfer', 'check', 'payment', 'refund');--> statement-breakpoint
ALTER TYPE "public"."project_status" ADD VALUE 'archived';--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"account_type" "account_type" NOT NULL,
	"account_subtype" "account_subtype",
	"parent_account_id" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar,
	"client_id" integer,
	"action" "audit_action" NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(100),
	"description" text,
	"metadata" jsonb,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"account_type" "bank_account_type" NOT NULL,
	"account_number" varchar(50),
	"routing_number" varchar(50),
	"bank_name" varchar(255),
	"opening_balance" varchar(20) DEFAULT '0',
	"current_balance" varchar(20) DEFAULT '0',
	"linked_account_id" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_reconciliations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_reconciliations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bank_account_id" integer NOT NULL,
	"statement_date" timestamp NOT NULL,
	"statement_ending_balance" varchar(20) NOT NULL,
	"cleared_balance" varchar(20),
	"difference" varchar(20),
	"status" "reconciliation_status" DEFAULT 'in_progress',
	"completed_at" timestamp,
	"completed_by_user_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bank_account_id" integer NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"transaction_type" "transaction_type" NOT NULL,
	"payee" varchar(255),
	"vendor_id" integer,
	"description" text,
	"reference" varchar(100),
	"check_number" varchar(20),
	"amount" varchar(20) NOT NULL,
	"account_id" integer,
	"is_cleared" boolean DEFAULT false,
	"is_reconciled" boolean DEFAULT false,
	"reconciliation_id" integer,
	"transfer_to_bank_account_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bill_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bill_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bill_id" integer NOT NULL,
	"account_id" integer,
	"description" text NOT NULL,
	"quantity" varchar(20) DEFAULT '1',
	"unit_price" varchar(20) NOT NULL,
	"amount" varchar(20) NOT NULL,
	"is_rebillable" boolean DEFAULT false,
	"rebillable_client_id" integer,
	"rebillable_project_id" integer,
	"markup_percent" varchar(10),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bill_payments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bill_payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bill_id" integer NOT NULL,
	"bank_account_id" integer NOT NULL,
	"bank_transaction_id" integer,
	"payment_date" timestamp NOT NULL,
	"amount" varchar(20) NOT NULL,
	"payment_method" varchar(50),
	"reference" varchar(100),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bills_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bill_number" varchar(50) NOT NULL,
	"vendor_id" integer NOT NULL,
	"bill_date" timestamp NOT NULL,
	"due_date" timestamp,
	"status" "bill_status" DEFAULT 'pending',
	"subtotal" varchar(20) NOT NULL,
	"tax" varchar(20),
	"total" varchar(20) NOT NULL,
	"amount_paid" varchar(20) DEFAULT '0',
	"amount_due" varchar(20) NOT NULL,
	"notes" text,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_portal_settings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "client_portal_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"client_id" integer NOT NULL,
	"show_projects" boolean DEFAULT true,
	"show_documents" boolean DEFAULT true,
	"show_invoices" boolean DEFAULT true,
	"show_messages" boolean DEFAULT true,
	"show_milestones" boolean DEFAULT true,
	"show_timeline" boolean DEFAULT true,
	"allow_document_upload" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "client_portal_settings_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "daily_activity_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "daily_activity_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"summary" text NOT NULL,
	"details" text,
	"hours_worked" varchar(10),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"project_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"requested_by_user_id" varchar,
	"document_type" varchar(100) NOT NULL,
	"description" text,
	"is_required" boolean DEFAULT true,
	"is_fulfilled" boolean DEFAULT false,
	"fulfilled_document_id" integer,
	"due_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expenses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vendor_id" integer,
	"bank_account_id" integer,
	"bank_transaction_id" integer,
	"expense_date" timestamp NOT NULL,
	"account_id" integer,
	"amount" varchar(20) NOT NULL,
	"description" text,
	"reference" varchar(100),
	"status" "expense_status" DEFAULT 'pending',
	"is_rebillable" boolean DEFAULT false,
	"rebillable_client_id" integer,
	"rebillable_project_id" integer,
	"markup_percent" varchar(10),
	"is_rebilled" boolean DEFAULT false,
	"rebilled_invoice_id" integer,
	"rebilled_at" timestamp,
	"notes" text,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "intake_applications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "intake_applications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"owner_name" varchar(255),
	"has_second_owner" boolean DEFAULT false,
	"second_owner_name" varchar(255),
	"business_name" varchar(255),
	"home_number" varchar(50),
	"cell_number" varchar(50),
	"email" varchar(255),
	"alternate_email" varchar(255),
	"current_address" text,
	"mailing_address" text,
	"mailing_address_same_as_current" boolean DEFAULT false,
	"date_of_birth" varchar(20),
	"ss_or_fid" varchar(50),
	"second_owner_business_name" varchar(255),
	"second_owner_home_number" varchar(50),
	"second_owner_cell_number" varchar(50),
	"second_owner_email" varchar(255),
	"second_owner_alternate_email" varchar(255),
	"second_owner_current_address" text,
	"second_owner_mailing_address" text,
	"second_owner_mailing_address_same_as_current" boolean DEFAULT false,
	"second_owner_date_of_birth" varchar(20),
	"second_owner_ss_or_fid" varchar(50),
	"project_name" varchar(255),
	"section" varchar(50),
	"block" varchar(50),
	"lot" varchar(50),
	"current_zoning" varchar(100),
	"location_side" varchar(100),
	"location_street" varchar(255),
	"location_feet" varchar(50),
	"location_of" varchar(255),
	"location_town" varchar(100),
	"location_village" varchar(100),
	"acreage_of_parcel" varchar(50),
	"zoning_district" varchar(100),
	"school_district" varchar(100),
	"postal_district" varchar(100),
	"fire_district" varchar(100),
	"ambulance_district" varchar(100),
	"water_district" varchar(100),
	"sewer_district" varchar(100),
	"project_details" text,
	"need_demolish_house" varchar(10),
	"well_being_done" varchar(10),
	"temporary_electric_gas_needed" varchar(10),
	"variance_from_subdivision" text,
	"open_space_offered" varchar(10),
	"open_space_amount" varchar(100),
	"subdivision_type" varchar(100),
	"total_building_size" varchar(100),
	"proposed_addition" varchar(255),
	"number_of_dwelling_units" varchar(50),
	"special_permit_use" text,
	"has_slopes_greater_than_25" varchar(10),
	"slopes_details" text,
	"has_streams" varchar(10),
	"streams_names" text,
	"has_wetlands" varchar(10),
	"wetlands_details" text,
	"has_been_reviewed_before" varchar(10),
	"project_history_narrative" text,
	"abutting_properties_tax_map" text,
	"proximity_features" jsonb DEFAULT '[]'::jsonb,
	"referral_agencies" jsonb DEFAULT '[]'::jsonb,
	"adjacent_municipality" varchar(255),
	"boards_approvals" jsonb DEFAULT '{}'::jsonb,
	"number_of_lots" varchar(50),
	"nydec_application_needed" varchar(10),
	"usacoa_application_needed" varchar(10),
	"status" "intake_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp,
	"created_by_user_id" varchar,
	"linked_client_id" integer,
	"linked_project_id" integer,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_milestones" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "project_milestones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"project_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"due_date" timestamp,
	"order_index" integer DEFAULT 0,
	"is_visible_to_client" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "proposal_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"proposal_id" integer NOT NULL,
	"service_id" integer,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" "service_category",
	"quantity" varchar(20) DEFAULT '1',
	"unit_price" varchar(20) NOT NULL,
	"amount" varchar(20) NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "proposals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"proposal_number" varchar(50) NOT NULL,
	"client_id" integer,
	"client_name" varchar(255) NOT NULL,
	"client_email" varchar(255),
	"client_phone" varchar(50),
	"client_company" varchar(255),
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "proposal_status" DEFAULT 'draft' NOT NULL,
	"subtotal" varchar(20) DEFAULT '0',
	"discount" varchar(20) DEFAULT '0',
	"tax" varchar(20) DEFAULT '0',
	"total" varchar(20) DEFAULT '0',
	"notes" text,
	"valid_until" timestamp,
	"sent_at" timestamp,
	"accepted_at" timestamp,
	"rejected_at" timestamp,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "services_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" "service_category" NOT NULL,
	"default_price" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vendors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"company" varchar(255),
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"city" varchar(100),
	"state" varchar(50),
	"zip" varchar(20),
	"tax_id" varchar(50),
	"notes" text,
	"default_expense_account_id" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "is_visible_to_client" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "document_status" "document_status" DEFAULT 'uploaded';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "reviewed_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "is_visible_to_client" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "is_visible_to_client" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "task_reminders" ADD COLUMN "is_read" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "associate_id" integer;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_linked_account_id_accounts_id_fk" FOREIGN KEY ("linked_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_transfer_to_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("transfer_to_bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_rebillable_client_id_clients_id_fk" FOREIGN KEY ("rebillable_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_rebillable_project_id_projects_id_fk" FOREIGN KEY ("rebillable_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_bank_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portal_settings" ADD CONSTRAINT "client_portal_settings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_activity_logs" ADD CONSTRAINT "daily_activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_fulfilled_document_id_documents_id_fk" FOREIGN KEY ("fulfilled_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_bank_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_rebillable_client_id_clients_id_fk" FOREIGN KEY ("rebillable_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_rebillable_project_id_projects_id_fk" FOREIGN KEY ("rebillable_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_rebilled_invoice_id_invoices_id_fk" FOREIGN KEY ("rebilled_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_applications" ADD CONSTRAINT "intake_applications_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_applications" ADD CONSTRAINT "intake_applications_linked_client_id_clients_id_fk" FOREIGN KEY ("linked_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_applications" ADD CONSTRAINT "intake_applications_linked_project_id_projects_id_fk" FOREIGN KEY ("linked_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_default_expense_account_id_accounts_id_fk" FOREIGN KEY ("default_expense_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_associate_id_associates_id_fk" FOREIGN KEY ("associate_id") REFERENCES "public"."associates"("id") ON DELETE no action ON UPDATE no action;