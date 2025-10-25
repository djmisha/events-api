# Quick Reference: SQL Commands to Run

This file provides a quick reference of the SQL commands needed to set up the new normalized schema.

## Single Command Setup

Open Supabase SQL Editor and run the entire file:
```
src/database/schema_new.sql
```

This creates all 4 tables with proper structure.

## What Gets Created

### Tables

1. **venues**
```sql
CREATE TABLE venues (
  id UUID PRIMARY KEY,
  external_id TEXT,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  country TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

2. **artists**
```sql
CREATE TABLE artists (
  id UUID PRIMARY KEY,
  external_id TEXT,
  name TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

3. **events_v2**
```sql
CREATE TABLE events_v2 (
  id BIGINT PRIMARY KEY,
  source TEXT,
  name TEXT,
  venue_id UUID,  -- FK to venues.id
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
  createddate TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

4. **event_artists**
```sql
CREATE TABLE event_artists (
  event_id BIGINT NOT NULL,  -- FK to events_v2.id
  artist_id UUID NOT NULL,   -- FK to artists.id
  role TEXT,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (event_id, artist_id)
);
```

### Foreign Keys

```sql
-- events_v2.venue_id → venues.id
ALTER TABLE events_v2 
  ADD CONSTRAINT fk_events_v2_venue 
  FOREIGN KEY (venue_id) REFERENCES venues(id);

-- event_artists.event_id → events_v2.id
ALTER TABLE event_artists 
  ADD CONSTRAINT fk_event_artists_event 
  FOREIGN KEY (event_id) REFERENCES events_v2(id);

-- event_artists.artist_id → artists.id
ALTER TABLE event_artists 
  ADD CONSTRAINT fk_event_artists_artist 
  FOREIGN KEY (artist_id) REFERENCES artists(id);
```

### Indexes

```sql
-- Unique indexes for upsert operations
CREATE UNIQUE INDEX idx_venues_external_id ON venues(external_id);
CREATE UNIQUE INDEX idx_artists_external_id ON artists(external_id);

-- Lookup indexes
CREATE INDEX idx_venues_name_city ON venues(name, city);
CREATE INDEX idx_artists_name ON artists(name);

-- Performance indexes for events_v2
CREATE INDEX idx_events_v2_location_id ON events_v2(location_id);
CREATE INDEX idx_events_v2_date ON events_v2(date);
CREATE INDEX idx_events_v2_location_date ON events_v2(location_id, date);
CREATE INDEX idx_events_v2_venue_id ON events_v2(venue_id);

-- Join index
CREATE INDEX idx_event_artists_artist_id ON event_artists(artist_id);
```

### Triggers

```sql
-- Auto-update updated_at columns
CREATE TRIGGER update_venues_updated_at
  BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_artists_updated_at
  BEFORE UPDATE ON artists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_v2_updated_at
  BEFORE UPDATE ON events_v2
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Verification Queries

After running the SQL, verify with these queries:

### Check Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('venues', 'artists', 'events_v2', 'event_artists')
ORDER BY table_name;
```

Expected result: 4 rows

### Check Foreign Keys
```sql
SELECT
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('events_v2', 'event_artists')
ORDER BY tc.table_name;
```

Expected result: 3 foreign keys

### Check Indexes
```sql
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('venues', 'artists', 'events_v2', 'event_artists')
ORDER BY tablename, indexname;
```

Expected result: 9+ indexes

### Check Triggers
```sql
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('venues', 'artists', 'events_v2')
ORDER BY event_object_table;
```

Expected result: 3 triggers

## Troubleshooting

### If tables already exist
```sql
-- Drop tables in correct order (if needed)
DROP TABLE IF EXISTS event_artists CASCADE;
DROP TABLE IF EXISTS events_v2 CASCADE;
DROP TABLE IF EXISTS artists CASCADE;
DROP TABLE IF EXISTS venues CASCADE;

-- Then re-run schema_new.sql
```

### If you need to start fresh
```sql
-- This removes all data and tables
DROP TABLE IF EXISTS event_artists CASCADE;
DROP TABLE IF EXISTS events_v2 CASCADE;
DROP TABLE IF EXISTS artists CASCADE;
DROP TABLE IF EXISTS venues CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Then re-run schema_new.sql
```

## Next Steps

1. ✅ Run `schema_new.sql` in Supabase SQL Editor
2. ✅ Verify tables created with verification queries above
3. ✅ Start your application: `npm run dev`
4. ✅ Test API endpoint to confirm data structure
5. ✅ Monitor logs to ensure data is being inserted correctly

The application will automatically:
- Fetch events from EDM Train and Ticketmaster
- Insert venues into `venues` table
- Insert artists into `artists` table
- Insert events into `events_v2` table with venue_id
- Create relationships in `event_artists` table

## Important Notes

- The existing `partner_events` table is **NOT** modified or dropped
- Both schemas can coexist
- No data migration or backfill required
- System starts fresh with new tables
- Historical data in `partner_events` remains accessible if needed
