-- Migration: Add genre tables
-- Date: 2025-10-29
-- Description: Creates prtnr_genres, prtnr_genre_subgenres, and prtnr_event_genres tables
-- Instructions: Run this in Supabase SQL Editor or via psql

BEGIN;

-- ============================================================================
-- 1. Create prtnr_genres table (master list of music genres)
-- ============================================================================
CREATE TABLE IF NOT EXISTS prtnr_genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  normalized_name TEXT,
  ticketmaster_genre_id TEXT,
  ticketmaster_segment_id TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on ticketmaster_genre_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_prtnr_genres_tm_id 
  ON prtnr_genres(ticketmaster_genre_id) 
  WHERE ticketmaster_genre_id IS NOT NULL;

-- Create index on normalized_name for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_prtnr_genres_normalized_name 
  ON prtnr_genres(normalized_name);

-- Create index on name for lookups
CREATE INDEX IF NOT EXISTS idx_prtnr_genres_name 
  ON prtnr_genres(name);

-- ============================================================================
-- 2. Create prtnr_genre_subgenres table (optional hierarchy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS prtnr_genre_subgenres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  genre_id UUID NOT NULL REFERENCES prtnr_genres(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT,
  ticketmaster_subgenre_id TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on ticketmaster_subgenre_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_prtnr_subgenres_tm_id 
  ON prtnr_genre_subgenres(ticketmaster_subgenre_id) 
  WHERE ticketmaster_subgenre_id IS NOT NULL;

-- Create index on genre_id for parent lookups
CREATE INDEX IF NOT EXISTS idx_prtnr_subgenres_genre_id 
  ON prtnr_genre_subgenres(genre_id);

-- Create index on name for lookups
CREATE INDEX IF NOT EXISTS idx_prtnr_subgenres_name 
  ON prtnr_genre_subgenres(name);

-- ============================================================================
-- 3. Create prtnr_event_genres join table (many-to-many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS prtnr_event_genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES prtnr_events(id) ON DELETE CASCADE,
  genre_id UUID NOT NULL REFERENCES prtnr_genres(id) ON DELETE CASCADE,
  classification_primary BOOLEAN DEFAULT false,
  ticketmaster_classification_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (event_id, genre_id)
);

-- Create indexes for efficient joins and lookups
CREATE INDEX IF NOT EXISTS idx_prtnr_event_genres_event_id 
  ON prtnr_event_genres(event_id);

CREATE INDEX IF NOT EXISTS idx_prtnr_event_genres_genre_id 
  ON prtnr_event_genres(genre_id);

CREATE INDEX IF NOT EXISTS idx_prtnr_event_genres_primary 
  ON prtnr_event_genres(event_id, classification_primary);

-- ============================================================================
-- 4. Auto-update trigger for prtnr_genres.updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_prtnr_genres_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prtnr_genres_updated_at
  BEFORE UPDATE ON prtnr_genres
  FOR EACH ROW
  EXECUTE FUNCTION update_prtnr_genres_updated_at();

COMMIT;

-- ============================================================================
-- Verification queries (run these after migration to verify)
-- ============================================================================
-- SELECT COUNT(*) FROM prtnr_genres;
-- SELECT COUNT(*) FROM prtnr_genre_subgenres;
-- SELECT COUNT(*) FROM prtnr_event_genres;
-- \d prtnr_genres
-- \d prtnr_genre_subgenres
-- \d prtnr_event_genres
