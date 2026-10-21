-- Durable, idempotent execution plans; no automatic activation.
CREATE TABLE IF NOT EXISTS automation_rules (
  id varchar(128) NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  trigger_type varchar(100) NOT NULL,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  requires_approval boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version)
);
CREATE TABLE IF NOT EXISTS automation_executions (
  id varchar(128) PRIMARY KEY,
  event_id varchar(128) NOT NULL REFERENCES automation_outbox(id),
  rule_id varchar(128) NOT NULL,
  rule_version integer NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','awaiting_approval','running','completed','failed','cancelled')),
  action_plan jsonb NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  approved_by varchar(128),
  approved_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT automation_executions_event_rule_unique UNIQUE (event_id, rule_id, rule_version),
  CONSTRAINT automation_executions_rule_fk FOREIGN KEY (rule_id, rule_version)
    REFERENCES automation_rules(id, version)
);
CREATE INDEX IF NOT EXISTS automation_executions_pending_idx
  ON automation_executions(next_attempt_at, created_at)
  WHERE status IN ('pending','failed');
CREATE TABLE IF NOT EXISTS automation_action_receipts (
  execution_id varchar(128) NOT NULL REFERENCES automation_executions(id),
  action_index integer NOT NULL CHECK (action_index >= 0),
  result_entity_type varchar(80),
  result_entity_id varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (execution_id, action_index)
);
