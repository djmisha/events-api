-- Migration: Normalize event schema - Create venues, artists, and join tables
-- Date: 2025-10-22
-- Description: Creates partner_venues, partner_artists, and partner_event_artists tables
--              Adds venue_id to partner_events and creates necessary indexes

-- ============================================================================
-- 1. Create partner_venues table
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  country TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on external_id for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_venues_external_id 
  ON partner_venues(external_id) 
  WHERE external_id IS NOT NULL;

-- Create index on name and city for lookups during backfill
CREATE INDEX IF NOT EXISTS idx_partner_venues_name_city 
  ON partner_venues(name, city);

-- ============================================================================
-- 2. Create partner_artists table
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,
  name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on external_id for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_artists_external_id 
  ON partner_artists(external_id) 
  WHERE external_id IS NOT NULL;

-- Create index on name for lookups
CREATE INDEX IF NOT EXISTS idx_partner_artists_name 
  ON partner_artists(name);

-- ============================================================================
-- 3. Create partner_event_artists join table
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_event_artists (
  event_id BIGINT NOT NULL,
  artist_id UUID NOT NULL,
  role TEXT,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (event_id, artist_id)
);

-- Add foreign key constraints
ALTER TABLE partner_event_artists 
  DROP CONSTRAINT IF EXISTS fk_partner_event_artists_event;
ALTER TABLE partner_event_artists 
  ADD CONSTRAINT fk_partner_event_artists_event 
  FOREIGN KEY (event_id) 
  REFERENCES partner_events(id) 
  ON DELETE CASCADE;

ALTER TABLE partner_event_artists 
  DROP CONSTRAINT IF EXISTS fk_partner_event_artists_artist;
ALTER TABLE partner_event_artists 
  ADD CONSTRAINT fk_partner_event_artists_artist 
  FOREIGN KEY (artist_id) 
  REFERENCES partner_artists(id) 
  ON DELETE CASCADE;

-- Create index on artist_id for reverse lookups
CREATE INDEX IF NOT EXISTS idx_partner_event_artists_artist_id 
  ON partner_event_artists(artist_id);

-- ============================================================================
-- 4. Add venue_id to partner_events
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'partner_events' 
    AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE partner_events ADD COLUMN venue_id UUID;
  END IF;
END $$;

-- Add foreign key constraint for venue_id
ALTER TABLE partner_events 
  DROP CONSTRAINT IF EXISTS fk_partner_events_venue;
ALTER TABLE partner_events 
  ADD CONSTRAINT fk_partner_events_venue 
  FOREIGN KEY (venue_id) 
  REFERENCES partner_venues(id) 
  ON DELETE SET NULL;

-- Create index on venue_id for joins
CREATE INDEX IF NOT EXISTS idx_partner_events_venue_id 
  ON partner_events(venue_id);

-- ============================================================================
-- 5. Add performance indexes on partner_events
-- ============================================================================
-- Index for city queries (commonly used in GET events by city)
CREATE INDEX IF NOT EXISTS idx_partner_events_city 
  ON partner_events(location_id);

-- Index for date queries
CREATE INDEX IF NOT EXISTS idx_partner_events_date 
  ON partner_events(date);

-- Composite index for city + date queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_partner_events_city_date 
  ON partner_events(location_id, date);

-- ============================================================================
-- 6. Create updated_at trigger function for timestamp management
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to automatically update updated_at columns
DROP TRIGGER IF EXISTS update_partner_venues_updated_at ON partner_venues;
CREATE TRIGGER update_partner_venues_updated_at
  BEFORE UPDATE ON partner_venues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_partner_artists_updated_at ON partner_artists;
CREATE TRIGGER update_partner_artists_updated_at
  BEFORE UPDATE ON partner_artists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration complete
-- ============================================================================
-- Note: This migration does NOT drop the existing venue and artistlist JSONB 
-- columns from partner_events. These will be retained as *_legacy columns 
-- after validation is complete.
