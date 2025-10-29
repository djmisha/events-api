-- Rollback: Remove genre tables
-- Date: 2025-10-29
-- Description: Drops prtnr_genres, prtnr_genre_subgenres, and prtnr_event_genres tables
-- Instructions: Run this in Supabase SQL Editor or via psql to rollback changes

BEGIN;

-- Drop tables in reverse order (respecting foreign keys)
DROP TABLE IF EXISTS prtnr_event_genres CASCADE;
DROP TABLE IF EXISTS prtnr_genre_subgenres CASCADE;
DROP TABLE IF EXISTS prtnr_genres CASCADE;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_prtnr_genres_updated_at CASCADE;

COMMIT;

-- Verification: Ensure tables are dropped
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'prtnr_%genre%';
