# Database Directory

This directory contains database schema and migration files for the Events API.

## Current Implementation: Fresh Setup

### Active File

**`schema_new.sql`** - Creates all new normalized tables from scratch
- Creates `venues`, `artists`, `events_v2`, `event_artists` tables
- No migration or backfill required
- Existing `partner_events` table untouched
- **Use this for new installations**

### Usage

```bash
# 1. Open Supabase SQL Editor
# 2. Copy contents of schema_new.sql
# 3. Execute the SQL
# 4. Done! Start your application
```

See `../FRESH_SETUP.md` for detailed setup instructions.

## Reference Files (Migration Approach)

The following files are kept as reference but are **not needed** for the current implementation:

### Migration Files (Reference Only)

- **`migrations/001_create_normalized_tables.sql`** - Original migration approach
  - Modifies `partner_events` table
  - Creates `partner_venues`, `partner_artists`, `partner_event_artists`
  - Requires backfill of existing data

- **`migrations/999_rollback_normalized_schema.sql`** - Rollback script
  - Reverts migration changes
  - Drops normalized tables

### Scripts (Reference Only)

- **`backfill.js`** - Migrates existing JSONB data to normalized tables
  - Not needed for fresh setup
  - Could be adapted if you need to import old data

- **`migrate.js`** - Migration helper script
  - Displays migration instructions
  - Not needed for fresh setup

- **`validate.js`** - Migration validation script
  - Validates migration success
  - Not needed for fresh setup

### Documentation

See `../APPROACH_COMPARISON.md` for explanation of:
- Migration approach (reference only)
- Fresh setup approach (current implementation)
- When to use each

## Table Structure

### New Tables (Created by schema_new.sql)

```
venues
├── id (UUID PK)
├── external_id (TEXT, unique)
├── name (TEXT)
├── city, state, country (TEXT)
└── metadata (JSONB)

artists
├── id (UUID PK)
├── external_id (TEXT, unique)
├── name (TEXT)
└── metadata (JSONB)

events_v2
├── id (BIGINT PK)
├── venue_id (UUID FK → venues.id)
├── source, name (TEXT)
├── location_id (INTEGER)
├── date (DATE)
└── [other event fields]

event_artists (join table)
├── event_id (BIGINT FK → events_v2.id)
├── artist_id (UUID FK → artists.id)
├── display_order (INTEGER)
└── PRIMARY KEY (event_id, artist_id)
```

## Quick Commands

### Create Tables
```sql
-- Run in Supabase SQL Editor
\i schema_new.sql
```

### Verify Tables
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('venues', 'artists', 'events_v2', 'event_artists');
```

### Check Data
```sql
-- Count records
SELECT 'venues' as table, COUNT(*) FROM venues
UNION ALL
SELECT 'artists', COUNT(*) FROM artists
UNION ALL
SELECT 'events_v2', COUNT(*) FROM events_v2
UNION ALL
SELECT 'event_artists', COUNT(*) FROM event_artists;
```

### Drop All (if needed)
```sql
DROP TABLE IF EXISTS event_artists CASCADE;
DROP TABLE IF EXISTS events_v2 CASCADE;
DROP TABLE IF EXISTS artists CASCADE;
DROP TABLE IF EXISTS venues CASCADE;
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
- See `../APPROACH_COMPARISON.md` for approach details
