/*
# Store a photo with each product

Owners upload images into the public product-images bucket.
The product row keeps the public URL in image_url.
*/

ALTER TABLE station_products ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "public read product images" ON storage.objects;
CREATE POLICY "public read product images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "owners upload product images" ON storage.objects;
CREATE POLICY "owners upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "owners update product images" ON storage.objects;
CREATE POLICY "owners update product images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "owners delete product images" ON storage.objects;
CREATE POLICY "owners delete product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');
