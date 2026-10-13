CREATE TABLE IF NOT EXISTS station_borrowed_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES station_customers(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES station_sales(id) ON DELETE SET NULL,
  container_code text NOT NULL,
  borrowed_at timestamptz NOT NULL DEFAULT now(),
  returned_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS station_borrowed_open_code
  ON station_borrowed_containers (lower(container_code))
  WHERE returned_at IS NULL;

ALTER TABLE station_borrowed_containers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_borrowed_containers_select" ON station_borrowed_containers;
DROP POLICY IF EXISTS "owner_borrowed_containers_insert" ON station_borrowed_containers;
DROP POLICY IF EXISTS "owner_borrowed_containers_update" ON station_borrowed_containers;
DROP POLICY IF EXISTS "owner_borrowed_containers_delete" ON station_borrowed_containers;
CREATE POLICY "owner_borrowed_containers_select" ON station_borrowed_containers FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner_borrowed_containers_insert" ON station_borrowed_containers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "owner_borrowed_containers_update" ON station_borrowed_containers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "owner_borrowed_containers_delete" ON station_borrowed_containers FOR DELETE TO authenticated USING (true);
