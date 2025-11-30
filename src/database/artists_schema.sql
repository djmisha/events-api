-- Artists Table Schema
-- 
-- This table stores comprehensive artist information aggregated from multiple sources
-- (EDM Train and Ticketmaster). Artists are never deleted, only added or updated.
--
-- Key Features:
-- - UUID primary key for internal references
-- - Slug for URL-friendly lookups
-- - External IDs from both EDM Train and Ticketmaster for cross-referencing
-- - Tags stored as JSONB for flexible categorization
-- - Bio for artist descriptions

-- Create the artists table
CREATE TABLE IF NOT EXISTS artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core artist information
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    
    -- Artist media
    image TEXT,
    
    -- Categorization (stored as JSONB array for flexibility)
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- External source IDs for cross-referencing
    ticketmaster_id VARCHAR(255),
    edmtrain_id INTEGER,
    
    -- Extended information
    bio TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists (name);
CREATE INDEX IF NOT EXISTS idx_artists_slug ON artists (slug);
CREATE INDEX IF NOT EXISTS idx_artists_ticketmaster_id ON artists (ticketmaster_id);
CREATE INDEX IF NOT EXISTS idx_artists_edmtrain_id ON artists (edmtrain_id);
CREATE INDEX IF NOT EXISTS idx_artists_name_search ON artists USING gin (to_tsvector('english', name));

-- Create unique partial indexes for external IDs (allowing multiple nulls)
CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_ticketmaster_id_unique 
    ON artists (ticketmaster_id) WHERE ticketmaster_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_edmtrain_id_unique 
    ON artists (edmtrain_id) WHERE edmtrain_id IS NOT NULL;

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_artists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function on updates
DROP TRIGGER IF EXISTS trigger_artists_updated_at ON artists;
CREATE TRIGGER trigger_artists_updated_at
    BEFORE UPDATE ON artists
    FOR EACH ROW
    EXECUTE FUNCTION update_artists_updated_at();

-- Add comments for documentation
COMMENT ON TABLE artists IS 'Master artist table aggregating data from EDM Train and Ticketmaster';
COMMENT ON COLUMN artists.id IS 'Internal UUID primary key';
COMMENT ON COLUMN artists.name IS 'Artist display name';
COMMENT ON COLUMN artists.slug IS 'URL-friendly slug derived from name';
COMMENT ON COLUMN artists.image IS 'URL to artist image';
COMMENT ON COLUMN artists.tags IS 'JSONB array of genre/style tags';
COMMENT ON COLUMN artists.ticketmaster_id IS 'External Ticketmaster attraction ID';
COMMENT ON COLUMN artists.edmtrain_id IS 'External EDM Train artist ID';
COMMENT ON COLUMN artists.bio IS 'Artist biography/description';
COMMENT ON COLUMN artists.metadata IS 'Additional metadata as JSONB';
