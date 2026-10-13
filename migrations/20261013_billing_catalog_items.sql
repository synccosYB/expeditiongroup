-- Billable Item catalog with immutable historical invoice amounts.
CREATE TABLE IF NOT EXISTS billing_catalog_items (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(255) NOT NULL UNIQUE,
  description text,
  unit varchar(20) NOT NULL DEFAULT 'hour' CHECK (unit IN ('hour', 'each', 'flat')),
  default_rate varchar(20) NOT NULL DEFAULT '0',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now()
);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS catalog_item_id integer REFERENCES billing_catalog_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_items_catalog_item ON invoice_items(catalog_item_id);

-- Presets are disabled until an administrator sets the appropriate hourly price.
-- We do not assume the sample $120 rate applies to all clients and services.
INSERT INTO billing_catalog_items (name, description, unit, default_rate, is_active, sort_order) VALUES
 ('Site Visit', 'On-site inspections and project visits', 'hour', '0', false, 10),
 ('Phone Call', 'Client, agency or contractor communications', 'hour', '0', false, 20),
 ('Permit Review', 'Permit application or revision review', 'hour', '0', false, 30),
 ('Document Preparation', 'Preparing and revising submissions', 'hour', '0', false, 40),
 ('Utility Coordination', 'Utility letters and coordination', 'hour', '0', false, 50),
 ('Site Meeting', 'On-site project and consultant meetings', 'hour', '0', false, 60),
 ('Engineering Review', 'Engineering response and review', 'hour', '0', false, 70),
 ('SWPPP Work', 'Stormwater management documentation', 'hour', '0', false, 80)
ON CONFLICT (name) DO NOTHING;
