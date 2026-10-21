-- Per-project opt-out. Defaults preserve existing projects without changing behavior.
CREATE TABLE IF NOT EXISTS automation_project_settings (
  project_id integer PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  updated_by varchar(128),
  updated_at timestamptz NOT NULL DEFAULT now()
);
