ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS check_company_name varchar(255);
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS check_company_address text;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS next_check_number integer DEFAULT 1;
ALTER TABLE bill_payments ADD COLUMN IF NOT EXISTS check_details jsonb;
