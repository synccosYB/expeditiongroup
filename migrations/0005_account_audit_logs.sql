-- Task #69: Guard sensitive account changes; record every role / link / delete change.

DO $$ BEGIN
  CREATE TYPE account_audit_action AS ENUM (
    'role_change',
    'client_link_change',
    'account_deleted',
    'account_restored'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS account_audit_logs (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  actor_user_id varchar,
  actor_email varchar(255),
  target_user_id varchar,
  target_email varchar(255),
  action account_audit_action NOT NULL,
  before_role varchar(32),
  after_role varchar(32),
  before_client_id integer,
  after_client_id integer,
  reason text,
  metadata jsonb,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_audit_target ON account_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_account_audit_created ON account_audit_logs(created_at);
