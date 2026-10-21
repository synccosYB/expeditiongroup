CREATE TABLE IF NOT EXISTS automation_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id varchar(128) NOT NULL,
  action varchar(80) NOT NULL,
  target_type varchar(80) NOT NULL,
  target_id varchar(128) NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_audit_created_idx ON automation_audit (created_at DESC);
