-- Add 'archived' value to client_status enum
ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'archived';
