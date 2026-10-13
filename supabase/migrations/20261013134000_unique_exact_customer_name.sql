/*
# Reject an exact duplicate customer name

The same spelling, including capitalization, can be stored only once.
"Juan Cruz" and "juan cruz" stay separate. A second "Juan Cruz" is rejected.
*/

CREATE UNIQUE INDEX IF NOT EXISTS station_customers_exact_name
  ON station_customers ((btrim(name)));
