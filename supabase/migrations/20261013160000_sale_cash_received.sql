/*
# Remember the cash handed over on a paid order

Order details can show cash received and the change.
Unpaid orders leave both columns empty.
*/

ALTER TABLE station_sales
  ADD COLUMN IF NOT EXISTS cash_received numeric(12,2),
  ADD COLUMN IF NOT EXISTS change_amount numeric(12,2);
