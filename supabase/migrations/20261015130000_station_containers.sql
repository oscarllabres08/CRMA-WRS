CREATE TABLE IF NOT EXISTS station_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS station_containers_code
  ON station_containers (lower(btrim(code)));

ALTER TABLE station_containers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_containers_select" ON station_containers;
DROP POLICY IF EXISTS "owner_containers_insert" ON station_containers;
DROP POLICY IF EXISTS "owner_containers_update" ON station_containers;
DROP POLICY IF EXISTS "owner_containers_delete" ON station_containers;
CREATE POLICY "owner_containers_select" ON station_containers FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner_containers_insert" ON station_containers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "owner_containers_update" ON station_containers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "owner_containers_delete" ON station_containers FOR DELETE TO authenticated USING (true);
