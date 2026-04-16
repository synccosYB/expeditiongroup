-- BUG-0184: Default projects to be visible to clients and backfill existing rows
ALTER TABLE projects ALTER COLUMN is_visible_to_client SET DEFAULT true;
UPDATE projects SET is_visible_to_client = true WHERE is_visible_to_client = false OR is_visible_to_client IS NULL;
