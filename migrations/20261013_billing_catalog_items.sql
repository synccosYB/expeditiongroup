-- Billable Item catalog with immutable historical invoice amounts.
CREATE TABLE IF NOT EXISTS billing_catalog_items (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(255) NOT NULL,
  description text,
  unit varchar(20) NOT NULL DEFAULT 'hour' CHECK (unit IN ('hour', 'each', 'flat')),
  default_rate varchar(20) NOT NULL DEFAULT '0',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now()
);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS catalog_item_id integer REFERENCES billing_catalog_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_items_catalog_item ON invoice_items(catalog_item_id);
