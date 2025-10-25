# Database Directory

This directory contains the database schema for the normalized events structure.

## Current Implementation

### Active File

**`schema.sql`** - Creates all normalized tables from scratch
- Creates `prtnr_venues`, `prtnr_artists`, `prtnr_events`, `prtnr_event_artists` tables
- No migration or backfill required
- Existing `partner_events` table untouched
- **Use this for setup**

### Usage

```bash
# 1. Open Supabase SQL Editor
# 2. Copy contents of schema.sql
# 3. Execute the SQL
# 4. Done! Start your application
```

See `../FRESH_SETUP.md` for detailed setup instructions.

## Table Structure

### Normalized Tables

```
prtnr_venues
├── id (UUID PK)
├── external_id (TEXT, unique)
├── name (TEXT)
├── city, state, country (TEXT)
└── metadata (JSONB)

prtnr_artists
├── id (UUID PK)
├── external_id (TEXT, unique)
├── name (TEXT)
└── metadata (JSONB)

prtnr_events
├── id (BIGINT PK)
├── venue_id (UUID FK → prtnr_venues.id)
├── source, name (TEXT)
├── location_id (INTEGER)
├── date (DATE)
└── [other event fields]

prtnr_event_artists (join table)
├── event_id (BIGINT FK → prtnr_events.id)
├── artist_id (UUID FK → prtnr_artists.id)
├── display_order (INTEGER)
└── PRIMARY KEY (event_id, artist_id)
```

## Quick Commands

### Create Tables
```sql
-- Run in Supabase SQL Editor
\i schema.sql
```

### Verify Tables
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'prtnr_%';
```

### Check Data
```sql
SELECT 
  'prtnr_venues' as table, COUNT(*) FROM prtnr_venues
UNION ALL
SELECT 'prtnr_artists', COUNT(*) FROM prtnr_artists
UNION ALL
SELECT 'prtnr_events', COUNT(*) FROM prtnr_events
UNION ALL
SELECT 'prtnr_event_artists', COUNT(*) FROM prtnr_event_artists;
```

### Drop All (if needed)
```sql
DROP TABLE IF EXISTS prtnr_event_artists CASCADE;
DROP TABLE IF EXISTS prtnr_events CASCADE;
DROP TABLE IF EXISTS prtnr_artists CASCADE;
DROP TABLE IF EXISTS prtnr_venues CASCADE;
```

## Benefits of Fresh Setup

✅ No migration complexity
✅ No risk to existing data
✅ Clean normalized structure from day one
✅ Both old and new schemas can coexist
✅ Easy to test and validate

## Support

- See `../FRESH_SETUP.md` for setup guide
- See `../SQL_REFERENCE.md` for SQL commands
- Check application logs for detailed error messages
