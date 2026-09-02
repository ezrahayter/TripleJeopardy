-- Shareable live report: a per-campaign public link that shows aggregate
-- performance plus a plain-language recap the operator generates.

alter table campaigns
  add column if not exists report_token text unique,
  add column if not exists report_recap text,
  add column if not exists report_recap_at timestamptz;
