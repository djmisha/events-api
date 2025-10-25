-- Fresh Normalized Schema for Events API
-- Date: 2025-10-25
-- Description: Creates normalized tables with prtnr_ prefix from scratch
--              Tables: prtnr_events, prtnr_venues, prtnr_artists, prtnr_event_artists
--              Existing partner_events table remains untouched

-- ============================================================================
-- 1. Create prtnr_venues table
-- ============================================================================
CREATE TABLE IF NOT EXISTS prtnr_venues (
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_prtnr_venues_external_id 
  ON prtnr_venues(external_id) 
  WHERE external_id IS NOT NULL;

-- Create index on name and city for lookups
CREATE INDEX IF NOT EXISTS idx_prtnr_venues_name_city 
  ON prtnr_venues(name, city);

-- ============================================================================
-- 2. Create prtnr_artists table
-- ============================================================================
CREATE TABLE IF NOT EXISTS prtnr_artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,
  name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on external_id for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_prtnr_artists_external_id 
  ON prtnr_artists(external_id) 
  WHERE external_id IS NOT NULL;

-- Create index on name for lookups
CREATE INDEX IF NOT EXISTS idx_prtnr_artists_name 
  ON prtnr_artists(name);

-- ============================================================================
-- 3. Create prtnr_events table (new normalized events table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS prtnr_events (
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
ALTER TABLE prtnr_events 
  DROP CONSTRAINT IF EXISTS fk_prtnr_events_venue;
ALTER TABLE prtnr_events 
  ADD CONSTRAINT fk_prtnr_events_venue 
  FOREIGN KEY (venue_id) 
  REFERENCES prtnr_venues(id) 
  ON DELETE SET NULL;

-- ============================================================================
-- 4. Create prtnr_event_artists join table
-- ============================================================================
CREATE TABLE IF NOT EXISTS prtnr_event_artists (
  event_id BIGINT NOT NULL,
  artist_id UUID NOT NULL,
  role TEXT,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (event_id, artist_id)
);

-- Add foreign key constraints
ALTER TABLE prtnr_event_artists 
  DROP CONSTRAINT IF EXISTS fk_prtnr_event_artists_event;
ALTER TABLE prtnr_event_artists 
  ADD CONSTRAINT fk_prtnr_event_artists_event 
  FOREIGN KEY (event_id) 
  REFERENCES prtnr_events(id) 
  ON DELETE CASCADE;

ALTER TABLE prtnr_event_artists 
  DROP CONSTRAINT IF EXISTS fk_prtnr_event_artists_artist;
ALTER TABLE prtnr_event_artists 
  ADD CONSTRAINT fk_prtnr_event_artists_artist 
  FOREIGN KEY (artist_id) 
  REFERENCES prtnr_artists(id) 
  ON DELETE CASCADE;

-- Create index on artist_id for reverse lookups
CREATE INDEX IF NOT EXISTS idx_prtnr_event_artists_artist_id 
  ON prtnr_event_artists(artist_id);

-- ============================================================================
-- 5. Add performance indexes on prtnr_events
-- ============================================================================
-- Index for city queries (commonly used in GET events by city)
CREATE INDEX IF NOT EXISTS idx_prtnr_events_location_id 
  ON prtnr_events(location_id);

-- Index for date queries
CREATE INDEX IF NOT EXISTS idx_prtnr_events_date 
  ON prtnr_events(date);

-- Composite index for city + date queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_prtnr_events_location_date 
  ON prtnr_events(location_id, date);

-- Index on venue_id for joins
CREATE INDEX IF NOT EXISTS idx_prtnr_events_venue_id 
  ON prtnr_events(venue_id);

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
DROP TRIGGER IF EXISTS update_prtnr_venues_updated_at ON prtnr_venues;
CREATE TRIGGER update_prtnr_venues_updated_at
  BEFORE UPDATE ON prtnr_venues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prtnr_artists_updated_at ON prtnr_artists;
CREATE TRIGGER update_prtnr_artists_updated_at
  BEFORE UPDATE ON prtnr_artists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prtnr_events_updated_at ON prtnr_events;
CREATE TRIGGER update_prtnr_events_updated_at
  BEFORE UPDATE ON prtnr_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Schema creation complete
-- ============================================================================
-- New Tables Created:
-- - prtnr_venues (venue records with UUID primary keys)
-- - prtnr_artists (artist records with UUID primary keys)
-- - prtnr_events (normalized event records with foreign key relationships)
-- - prtnr_event_artists (join table for many-to-many event-artist relationships)
--
-- The existing partner_events table is left untouched.
-- Both schemas can coexist if needed.
