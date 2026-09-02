-- Keep the candidate's original filename on request uploads, so the operator
-- can download "endorsement-logo.png" instead of a hashed storage key. Ava's
-- form already asks for "identifiable file names" — honour that.
alter table post_request_media add column filename text;
