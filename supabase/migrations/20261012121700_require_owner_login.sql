/*
# Require a signed-in water station owner

Anonymous visitors can no longer read or change station records.
Owner profile rows are created from the account registered in the app.
*/

CREATE TABLE IF NOT EXISTS station_owners (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  station_name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE station_owners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_select_own" ON station_owners;
CREATE POLICY "owners_select_own" ON station_owners FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "owners_insert_own" ON station_owners;
CREATE POLICY "owners_insert_own" ON station_owners FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "owners_update_own" ON station_owners;
CREATE POLICY "owners_update_own" ON station_owners FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_station_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.station_owners (id, full_name, station_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Station owner'),
    COALESCE(NEW.raw_user_meta_data->>'station_name', 'CRMA Water Refilling Station'),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      station_name = EXCLUDED.station_name,
      email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_station_owner ON auth.users;
CREATE TRIGGER on_auth_user_created_station_owner
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_station_owner();

DROP POLICY IF EXISTS "shared_station_products_select" ON station_products;
DROP POLICY IF EXISTS "shared_station_products_insert" ON station_products;
DROP POLICY IF EXISTS "shared_station_products_update" ON station_products;
DROP POLICY IF EXISTS "shared_station_products_delete" ON station_products;
CREATE POLICY "owner_station_products_select" ON station_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner_station_products_insert" ON station_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "owner_station_products_update" ON station_products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "owner_station_products_delete" ON station_products FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "shared_station_customers_select" ON station_customers;
DROP POLICY IF EXISTS "shared_station_customers_insert" ON station_customers;
DROP POLICY IF EXISTS "shared_station_customers_update" ON station_customers;
DROP POLICY IF EXISTS "shared_station_customers_delete" ON station_customers;
CREATE POLICY "owner_station_customers_select" ON station_customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner_station_customers_insert" ON station_customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "owner_station_customers_update" ON station_customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "owner_station_customers_delete" ON station_customers FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "shared_station_sales_select" ON station_sales;
DROP POLICY IF EXISTS "shared_station_sales_insert" ON station_sales;
DROP POLICY IF EXISTS "shared_station_sales_update" ON station_sales;
DROP POLICY IF EXISTS "shared_station_sales_delete" ON station_sales;
CREATE POLICY "owner_station_sales_select" ON station_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner_station_sales_insert" ON station_sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "owner_station_sales_update" ON station_sales FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "owner_station_sales_delete" ON station_sales FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "shared_station_sale_items_select" ON station_sale_items;
DROP POLICY IF EXISTS "shared_station_sale_items_insert" ON station_sale_items;
DROP POLICY IF EXISTS "shared_station_sale_items_update" ON station_sale_items;
DROP POLICY IF EXISTS "shared_station_sale_items_delete" ON station_sale_items;
CREATE POLICY "owner_station_sale_items_select" ON station_sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner_station_sale_items_insert" ON station_sale_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "owner_station_sale_items_update" ON station_sale_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "owner_station_sale_items_delete" ON station_sale_items FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "shared_station_expenses_select" ON station_expenses;
DROP POLICY IF EXISTS "shared_station_expenses_insert" ON station_expenses;
DROP POLICY IF EXISTS "shared_station_expenses_update" ON station_expenses;
DROP POLICY IF EXISTS "shared_station_expenses_delete" ON station_expenses;
CREATE POLICY "owner_station_expenses_select" ON station_expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner_station_expenses_insert" ON station_expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "owner_station_expenses_update" ON station_expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "owner_station_expenses_delete" ON station_expenses FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "shared_station_settings_select" ON station_settings;
DROP POLICY IF EXISTS "shared_station_settings_insert" ON station_settings;
DROP POLICY IF EXISTS "shared_station_settings_update" ON station_settings;
DROP POLICY IF EXISTS "shared_station_settings_delete" ON station_settings;
CREATE POLICY "owner_station_settings_select" ON station_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner_station_settings_insert" ON station_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "owner_station_settings_update" ON station_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "owner_station_settings_delete" ON station_settings FOR DELETE TO authenticated USING (true);
