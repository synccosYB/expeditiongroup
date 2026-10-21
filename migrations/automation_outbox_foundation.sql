-- Automation outbox foundation. Additive only; no historical backfill or triggers.
-- Events must be inserted in the same transaction as the originating business write.
CREATE TABLE IF NOT EXISTS automation_outbox (
  id varchar(128) PRIMARY KEY,
  event_type varchar(100) NOT NULL,
  entity_id varchar(128) NOT NULL,
  project_id varchar(128),
  client_id varchar(128),
  actor_kind varchar(16) NOT NULL CHECK (actor_kind IN ('user', 'system')),
  actor_id varchar(128) NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  occurred_at timestamptz NOT NULL,
  changes jsonb,
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_outbox_pending_idx
  ON automation_outbox (available_at, created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS automation_outbox_entity_idx
  ON automation_outbox (event_type, entity_id, occurred_at DESC);
