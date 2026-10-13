/*
# Loyalty refills and unpaid balances

Paid water refills earn 1 point per container.
11 points can be exchanged for 1 free refill, then those 11 points are used.
Unpaid orders stay on the sale record and do not earn points.
*/

ALTER TABLE station_customers
  ADD COLUMN IF NOT EXISTS refill_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_refills_claimed integer NOT NULL DEFAULT 0;
