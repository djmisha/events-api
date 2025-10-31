# SQL Reference - Quick Commands

This file provides SQL commands for setting up and managing the normalized schema.

## Setup Command

Open Supabase SQL Editor and run:
```
src/database/schema.sql
```

This creates all 4 tables with proper structure.

## Tables Created

### prtnr_venues
```sql
CREATE TABLE prtnr_venues (
  id UUID PRIMARY KEY,
  external_id TEXT UNIQUE,
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

### prtnr_artists
```sql
CREATE TABLE prtnr_artists (
  id UUID PRIMARY KEY,
  external_id TEXT UNIQUE,
  name TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### prtnr_events
```sql
CREATE TABLE prtnr_events (
  id BIGINT PRIMARY KEY,
  source TEXT,
  name TEXT,
  venue_id UUID,  -- FK to prtnr_venues.id
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

### prtnr_event_artists
```sql
CREATE TABLE prtnr_event_artists (
  event_id BIGINT NOT NULL,  -- FK to prtnr_events.id
  artist_id UUID NOT NULL,   -- FK to prtnr_artists.id
  role TEXT,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (event_id, artist_id)
);
```

## Verification Queries

### Check Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('prtnr_venues', 'prtnr_artists', 'prtnr_events', 'prtnr_event_artists')
ORDER BY table_name;
```

Expected result: 4 rows

### Check Foreign Keys
```sql
SELECT
    tc.table_name, 
    tc.constraint_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('prtnr_events', 'prtnr_event_artists')
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
WHERE tablename IN ('prtnr_venues', 'prtnr_artists', 'prtnr_events', 'prtnr_event_artists')
ORDER BY tablename, indexname;
```

Expected result: 9+ indexes

### Check Data Counts
```sql
SELECT 
  'prtnr_venues' as table_name, COUNT(*) as count FROM prtnr_venues
UNION ALL
SELECT 'prtnr_artists', COUNT(*) FROM prtnr_artists
UNION ALL
SELECT 'prtnr_events', COUNT(*) FROM prtnr_events
UNION ALL
SELECT 'prtnr_event_artists', COUNT(*) FROM prtnr_event_artists;
```

## Example Queries

### Get Events with Venues and Artists
```sql
SELECT 
  e.*,
  v.name as venue_name,
  v.city as venue_city,
  ARRAY_AGG(a.name ORDER BY pea.display_order) as artist_names
FROM prtnr_events e
LEFT JOIN prtnr_venues v ON e.venue_id = v.id
LEFT JOIN prtnr_event_artists pea ON e.id = pea.event_id
LEFT JOIN prtnr_artists a ON pea.artist_id = a.id
WHERE e.location_id = 71
GROUP BY e.id, v.name, v.city
ORDER BY e.date
LIMIT 10;
```

### Get All Events at a Specific Venue
```sql
SELECT e.* 
FROM prtnr_events e
JOIN prtnr_venues v ON e.venue_id = v.id
WHERE v.name = 'Chicago Theatre'
ORDER BY e.date;
```

### Get All Events for a Specific Artist
```sql
SELECT e.*
FROM prtnr_events e
JOIN prtnr_event_artists pea ON e.id = pea.event_id
JOIN prtnr_artists a ON pea.artist_id = a.id
WHERE a.name = 'Artist Name'
ORDER BY e.date;
```

### Get Venue Statistics
```sql
SELECT 
  v.name, 
  v.city, 
  COUNT(e.id) as event_count
FROM prtnr_venues v
LEFT JOIN prtnr_events e ON v.id = e.venue_id
GROUP BY v.id, v.name, v.city
ORDER BY event_count DESC
LIMIT 10;
```

### Get Popular Artists
```sql
SELECT 
  a.name, 
  COUNT(pea.event_id) as event_count
FROM prtnr_artists a
JOIN prtnr_event_artists pea ON a.id = pea.artist_id
GROUP BY a.id, a.name
ORDER BY event_count DESC
LIMIT 10;
```

## Cleanup Commands

### Drop All Tables (if needed)
```sql
DROP TABLE IF EXISTS prtnr_event_artists CASCADE;
DROP TABLE IF EXISTS prtnr_events CASCADE;
DROP TABLE IF EXISTS prtnr_artists CASCADE;
DROP TABLE IF EXISTS prtnr_venues CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
```

### Truncate All Tables (keep structure, remove data)
```sql
TRUNCATE TABLE prtnr_event_artists CASCADE;
TRUNCATE TABLE prtnr_events CASCADE;
TRUNCATE TABLE prtnr_artists CASCADE;
TRUNCATE TABLE prtnr_venues CASCADE;
```

## Performance Tips

1. **Use the composite index** for city queries:
   - `location_id, date` index optimizes most common queries

2. **External IDs are indexed** for fast upserts:
   - Use external_id when upserting to avoid duplicates

3. **Foreign keys are indexed** for joins:
   - Joins between tables are optimized automatically

## Important Notes

- The existing `partner_events` table is **NOT** modified or dropped
- Both schemas can coexist indefinitely
- No data migration or backfill required
- System starts fresh with new tables
