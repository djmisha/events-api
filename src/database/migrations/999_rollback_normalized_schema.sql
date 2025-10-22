-- Rollback Script: Remove normalized schema changes
-- Date: 2025-10-22
-- Description: Removes the normalized tables and foreign keys
-- WARNING: This will delete all normalized venue and artist data!
--          Only use this if you need to rollback the migration.
--          Ensure you have a database backup before running.

-- ============================================================================
-- IMPORTANT: Read before executing
-- ============================================================================
-- This script performs a destructive rollback. Data in the normalized tables
-- will be permanently deleted. The legacy JSONB columns (venue, artistlist)
-- should still be present in partner_events if you haven't removed them.
-- ============================================================================

-- Remove foreign key constraints first
ALTER TABLE partner_events 
  DROP CONSTRAINT IF EXISTS fk_partner_events_venue;

ALTER TABLE partner_event_artists 
  DROP CONSTRAINT IF EXISTS fk_partner_event_artists_event;

ALTER TABLE partner_event_artists 
  DROP CONSTRAINT IF EXISTS fk_partner_event_artists_artist;

-- Drop triggers
DROP TRIGGER IF EXISTS update_partner_venues_updated_at ON partner_venues;
DROP TRIGGER IF EXISTS update_partner_artists_updated_at ON partner_artists;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes on partner_events
DROP INDEX IF EXISTS idx_partner_events_venue_id;
DROP INDEX IF EXISTS idx_partner_events_city;
DROP INDEX IF EXISTS idx_partner_events_date;
DROP INDEX IF EXISTS idx_partner_events_city_date;

-- Drop join table
DROP TABLE IF EXISTS partner_event_artists CASCADE;

-- Drop artist table
DROP TABLE IF EXISTS partner_artists CASCADE;

-- Drop venue table
DROP TABLE IF EXISTS partner_venues CASCADE;

-- Remove venue_id column from partner_events
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'partner_events' 
    AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE partner_events DROP COLUMN venue_id;
  END IF;
END $$;

-- Verification: Ensure legacy columns still exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'partner_events' 
    AND column_name = 'venue'
  ) THEN
    RAISE EXCEPTION 'Legacy venue column is missing! Rollback may result in data loss.';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'partner_events' 
    AND column_name = 'artistlist'
  ) THEN
    RAISE EXCEPTION 'Legacy artistlist column is missing! Rollback may result in data loss.';
  END IF;
  
  RAISE NOTICE 'Rollback complete. Legacy JSONB columns are intact.';
END $$;

-- ============================================================================
-- Post-Rollback Verification
-- ============================================================================
-- Run these queries to verify the rollback:
--
-- 1. Check tables are removed:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('partner_venues', 'partner_artists', 'partner_event_artists');
-- (Should return 0 rows)
--
-- 2. Check venue_id column is removed:
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'partner_events' AND column_name = 'venue_id';
-- (Should return 0 rows)
--
-- 3. Check legacy columns still exist:
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'partner_events' 
-- AND column_name IN ('venue', 'artistlist');
-- (Should return 2 rows)
-- ============================================================================
