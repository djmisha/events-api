-- Top Artists Table
-- This table stores pre-calculated top 200 touring artists
-- Updated weekly via webhook job for optimal serverless performance

CREATE TABLE IF NOT EXISTS prtnr_top_artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES prtnr_artists(id) ON DELETE CASCADE,
  artist_name TEXT NOT NULL,
  total_shows INTEGER NOT NULL DEFAULT 0,
  unique_cities INTEGER NOT NULL DEFAULT 0,
  rank_by_shows INTEGER,
  rank_by_cities INTEGER,
  last_calculated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_top_artists_artist_id ON prtnr_top_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_top_artists_rank_shows ON prtnr_top_artists(rank_by_shows);
CREATE INDEX IF NOT EXISTS idx_top_artists_rank_cities ON prtnr_top_artists(rank_by_cities);
CREATE INDEX IF NOT EXISTS idx_top_artists_total_shows ON prtnr_top_artists(total_shows DESC);
CREATE INDEX IF NOT EXISTS idx_top_artists_unique_cities ON prtnr_top_artists(unique_cities DESC);

-- Ensure artist_id is unique in top artists table
CREATE UNIQUE INDEX IF NOT EXISTS idx_top_artists_artist_id_unique ON prtnr_top_artists(artist_id);

-- Add comment to table
COMMENT ON TABLE prtnr_top_artists IS 'Stores top 200 touring artists by show count and unique cities, updated weekly';
COMMENT ON COLUMN prtnr_top_artists.total_shows IS 'Total number of shows/events for this artist';
COMMENT ON COLUMN prtnr_top_artists.unique_cities IS 'Number of unique cities where artist has performed';
COMMENT ON COLUMN prtnr_top_artists.rank_by_shows IS 'Ranking based on total shows (1 = most shows)';
COMMENT ON COLUMN prtnr_top_artists.rank_by_cities IS 'Ranking based on unique cities (1 = most cities)';
