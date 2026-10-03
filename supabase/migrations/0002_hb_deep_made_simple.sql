-- THE HOLY BIBLE — Deep Made Simple (research, stories, links) as a reviewable object type.
-- Adds 'deep' to the object types the editorial ledger accepts. Nothing else changes: the ledger stays
-- append-only, and every decision still needs a named reviewer who checked it against the text.

alter table public.hb_editorial_reviews drop constraint if exists hb_editorial_reviews_object_type_check;
alter table public.hb_editorial_reviews add constraint hb_editorial_reviews_object_type_check
  check (object_type in ('connection','place','person','journey','timeline','thread','genealogy','scale','insert','phrase','deep'));
