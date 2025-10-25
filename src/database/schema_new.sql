-- New Schema: Fresh normalized tables (no migration needed)
-- Date: 2025-10-25
-- Description: Creates all new tables with normalized structure from scratch
--              New table names: events_v2, venues, artists, event_artists
--              Existing partner_events table remains untouched

-- ============================================================================
-- 1. Create venues table
-- ============================================================================
CREATE TABLE IF NOT EXISTS venues (
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_external_id 
  ON venues(external_id) 
  WHERE external_id IS NOT NULL;

-- Create index on name and city for lookups
CREATE INDEX IF NOT EXISTS idx_venues_name_city 
  ON venues(name, city);

-- ============================================================================
-- 2. Create artists table
-- ============================================================================
CREATE TABLE IF NOT EXISTS artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,
  name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on external_id for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_external_id 
  ON artists(external_id) 
  WHERE external_id IS NOT NULL;

-- Create index on name for lookups
CREATE INDEX IF NOT EXISTS idx_artists_name 
  ON artists(name);

-- ============================================================================
-- 3. Create events_v2 table (new normalized events table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS events_v2 (
  id BIGINT PRIMARY KEY,
  source TEXT,
  name TEXT,
  venue_id UUID,
  location_id INTEGER,
  date DATE,
  starttime TIME,
  endtime TIME,
  link TEXT,
  ages TEXT,
  festivalind BOOLEAN,
  livestreamind BOOLEAN,
  electronicgenreind BOOLEAN,
  othergenreind BOOLEAN,
  createddate TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint for venue_id
ALTER TABLE events_v2 
  DROP CONSTRAINT IF EXISTS fk_events_v2_venue;
ALTER TABLE events_v2 
  ADD CONSTRAINT fk_events_v2_venue 
  FOREIGN KEY (venue_id) 
  REFERENCES venues(id) 
  ON DELETE SET NULL;

-- ============================================================================
-- 4. Create event_artists join table
-- ============================================================================
CREATE TABLE IF NOT EXISTS event_artists (
  event_id BIGINT NOT NULL,
  artist_id UUID NOT NULL,
  role TEXT,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (event_id, artist_id)
);

-- Add foreign key constraints
ALTER TABLE event_artists 
  DROP CONSTRAINT IF EXISTS fk_event_artists_event;
ALTER TABLE event_artists 
  ADD CONSTRAINT fk_event_artists_event 
  FOREIGN KEY (event_id) 
  REFERENCES events_v2(id) 
  ON DELETE CASCADE;

ALTER TABLE event_artists 
  DROP CONSTRAINT IF EXISTS fk_event_artists_artist;
ALTER TABLE event_artists 
  ADD CONSTRAINT fk_event_artists_artist 
  FOREIGN KEY (artist_id) 
  REFERENCES artists(id) 
  ON DELETE CASCADE;

-- Create index on artist_id for reverse lookups
CREATE INDEX IF NOT EXISTS idx_event_artists_artist_id 
  ON event_artists(artist_id);

-- ============================================================================
-- 5. Add performance indexes on events_v2
-- ============================================================================
-- Index for city queries (commonly used in GET events by city)
CREATE INDEX IF NOT EXISTS idx_events_v2_location_id 
  ON events_v2(location_id);

-- Index for date queries
CREATE INDEX IF NOT EXISTS idx_events_v2_date 
  ON events_v2(date);

-- Composite index for city + date queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_events_v2_location_date 
  ON events_v2(location_id, date);

-- Index on venue_id for joins
CREATE INDEX IF NOT EXISTS idx_events_v2_venue_id 
  ON events_v2(venue_id);

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
DROP TRIGGER IF EXISTS update_venues_updated_at ON venues;
CREATE TRIGGER update_venues_updated_at
  BEFORE UPDATE ON venues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_artists_updated_at ON artists;
CREATE TRIGGER update_artists_updated_at
  BEFORE UPDATE ON artists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_events_v2_updated_at ON events_v2;
CREATE TRIGGER update_events_v2_updated_at
  BEFORE UPDATE ON events_v2
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Schema creation complete
-- ============================================================================
-- Note: This creates entirely new tables. The existing partner_events table
-- is left untouched. You can run both systems in parallel if needed.
--
-- New Tables:
-- - venues (replaces partner_venues concept)
-- - artists (replaces partner_artists concept)
-- - events_v2 (new normalized events table)
-- - event_artists (join table for many-to-many relationships)
