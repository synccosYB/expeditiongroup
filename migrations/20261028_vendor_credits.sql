BEGIN;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS amount_credited varchar(20) NOT NULL DEFAULT '0';
CREATE TABLE IF NOT EXISTS vendor_credits (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 vendor_id integer NOT NULL REFERENCES vendors(id),
 account_id integer NOT NULL REFERENCES accounts(id),
 credit_date timestamp NOT NULL,
 amount varchar(20) NOT NULL CHECK (amount::numeric > 0),
 reference varchar(100), memo text,
 request_id varchar(36) NOT NULL UNIQUE,
 created_by_user_id varchar REFERENCES users(id), created_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vendor_credit_applications (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 credit_id integer NOT NULL REFERENCES vendor_credits(id),
 bill_id integer NOT NULL REFERENCES bills(id),
 application_date timestamp NOT NULL,
 amount varchar(20) NOT NULL CHECK (amount::numeric > 0),
 request_id varchar(36) NOT NULL UNIQUE,
 created_by_user_id varchar REFERENCES users(id), created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_credit_applications_bill_idx ON vendor_credit_applications(bill_id);
CREATE INDEX IF NOT EXISTS vendor_credit_applications_credit_idx ON vendor_credit_applications(credit_id);
CREATE TABLE IF NOT EXISTS vendor_refunds (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 credit_id integer NOT NULL REFERENCES vendor_credits(id),
 bank_transaction_id integer NOT NULL UNIQUE REFERENCES bank_transactions(id),
 refund_date timestamp NOT NULL,
 amount varchar(20) NOT NULL CHECK (amount::numeric > 0),
 reference varchar(100), request_id varchar(36) NOT NULL UNIQUE,
 created_by_user_id varchar REFERENCES users(id), created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_refunds_credit_idx ON vendor_refunds(credit_id);
-- Existing bill writers must preserve applied credits when recalculating cash payments.
CREATE OR REPLACE FUNCTION preserve_bill_vendor_credits() RETURNS trigger AS $$
DECLARE credited numeric;
BEGIN
 SELECT coalesce(sum(amount::numeric), 0) INTO credited FROM vendor_credit_applications WHERE bill_id = NEW.id;
 NEW.amount_credited := credited::text;
 IF credited > 0 THEN
   IF NEW.vendor_id <> OLD.vendor_id OR NEW.status IN ('draft','void') OR NEW.total::numeric < coalesce(NEW.amount_paid,'0')::numeric + credited THEN
     RAISE EXCEPTION 'Reverse vendor credit applications before changing this bill or exceeding its remaining balance';
   END IF;
   NEW.amount_due := (NEW.total::numeric - coalesce(NEW.amount_paid,'0')::numeric - credited)::text;
   NEW.status := CASE WHEN NEW.amount_due::numeric = 0 THEN 'paid'::bill_status ELSE 'partial'::bill_status END;
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS preserve_bill_vendor_credits ON bills;
CREATE TRIGGER preserve_bill_vendor_credits BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION preserve_bill_vendor_credits();
COMMIT;
