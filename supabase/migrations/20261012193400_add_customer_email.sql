ALTER TABLE station_customers
  ADD COLUMN IF NOT EXISTS email text;
