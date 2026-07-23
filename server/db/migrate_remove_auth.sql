-- Removes auth from an existing Metrixis database.
-- Run with: psql "$DATABASE_URL" -f db/migrate_remove_auth.sql
--
-- Safe to run even if users/sites already look like this — uses IF EXISTS
-- guards throughout.

ALTER TABLE sites DROP COLUMN IF EXISTS user_id;
DROP INDEX IF EXISTS idx_sites_user_id;
DROP TABLE IF EXISTS users;
