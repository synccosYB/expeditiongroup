-- Persist internal automation notifications in a separate delivery inbox.
-- These are in-app records only; they are not emails or SMS.
CREATE TABLE IF NOT EXISTS automation_notifications (
  id varchar(128) PRIMARY KEY,
  execution_id varchar(128) NOT NULL REFERENCES automation_executions(id) ON DELETE CASCADE,
  action_index integer NOT NULL,
  project_id integer REFERENCES projects(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (execution_id, action_index)
);
CREATE INDEX IF NOT EXISTS automation_notifications_unread_idx
  ON automation_notifications (created_at DESC) WHERE is_read = false;
