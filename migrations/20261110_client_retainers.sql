-- Additive. Run in a transaction before deploying the new application.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'projects'::regclass AND conname = 'projects_id_client_id_key'
  ) THEN
    ALTER TABLE projects ADD CONSTRAINT projects_id_client_id_key UNIQUE (id, client_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS client_retainers (
  project_id integer PRIMARY KEY,
  client_id integer NOT NULL,
  target_cents integer NOT NULL,
  threshold_cents integer NOT NULL,
  CONSTRAINT client_retainers_project_owner_fk
    FOREIGN KEY (project_id, client_id) REFERENCES projects (id, client_id) ON DELETE CASCADE,
  CONSTRAINT client_retainers_amounts_check
    CHECK (target_cents > 0 AND threshold_cents BETWEEN 0 AND target_cents - 1)
);

CREATE TABLE IF NOT EXISTS client_retainer_requests (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id integer NOT NULL REFERENCES client_retainers (project_id),
  kind varchar(20) NOT NULL CONSTRAINT client_retainer_requests_kind_check CHECK (kind IN ('initial', 'replenishment')),
  status varchar(20) NOT NULL DEFAULT 'open'
    CONSTRAINT client_retainer_requests_status_check CHECK (status IN ('open', 'paid', 'cancelled')),
  amount_cents integer NOT NULL CONSTRAINT client_retainer_requests_amount_check CHECK (amount_cents > 0),
  due_date date,
  note text,
  operation_id uuid NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  created_by_user_id varchar REFERENCES users (id),
  CONSTRAINT client_retainer_requests_operation_key UNIQUE (project_id, operation_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS client_retainer_requests_one_open
  ON client_retainer_requests (project_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS client_retainer_applications (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id integer NOT NULL REFERENCES client_retainers (project_id),
  invoice_id integer NOT NULL REFERENCES invoices (id),
  amount_cents integer NOT NULL CONSTRAINT client_retainer_applications_amount_check CHECK (amount_cents > 0),
  operation_id uuid NOT NULL,
  applied_at timestamp NOT NULL DEFAULT now(),
  created_by_user_id varchar REFERENCES users (id),
  reversed_at timestamp,
  reversed_by_user_id varchar REFERENCES users (id),
  CONSTRAINT client_retainer_applications_operation_key UNIQUE (project_id, operation_id)
);

CREATE INDEX IF NOT EXISTS client_retainer_applications_invoice_idx
  ON client_retainer_applications (invoice_id);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS retainer_request_id integer REFERENCES client_retainer_requests (id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS retainer_receipt_key uuid;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS retainer_voided_at timestamp;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS retainer_voided_by_user_id varchar REFERENCES users (id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'payments'::regclass AND conname = 'payments_retainer_receipt_key'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_retainer_receipt_key UNIQUE (retainer_request_id, retainer_receipt_key);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'payments'::regclass AND conname = 'payments_retainer_receipt_check'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_retainer_receipt_check CHECK (
      (retainer_request_id IS NULL AND retainer_receipt_key IS NULL
        AND retainer_voided_at IS NULL AND retainer_voided_by_user_id IS NULL)
      OR (retainer_request_id IS NOT NULL AND retainer_receipt_key IS NOT NULL AND invoice_id IS NULL
        AND (retainer_voided_at IS NULL OR (is_deposited IS FALSE AND deposit_id IS NULL)))
    );
  END IF;
END $$;

INSERT INTO accounts (code, name, description, account_type, account_subtype, is_active)
VALUES ('CLIENT-RETAINERS', 'Client Retainers', 'Client funds held for future invoice applications',
        'liability', 'other_current_liability', true)
ON CONFLICT (code) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM accounts WHERE code = 'CLIENT-RETAINERS'
      AND account_type = 'liability' AND account_subtype = 'other_current_liability'
      AND is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'CLIENT-RETAINERS must be an active current liability account';
  END IF;
END $$;
