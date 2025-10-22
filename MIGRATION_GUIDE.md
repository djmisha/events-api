# Schema Normalization Migration Guide

This guide details the steps to migrate from JSONB-based venue and artist storage to a normalized relational schema.

## Overview

The migration normalizes the event schema by:
- Creating `partner_venues` table for venue data
- Creating `partner_artists` table for artist data
- Creating `partner_event_artists` join table for event-artist relationships
- Adding `venue_id` foreign key to `partner_events`
- Adding performance indexes
- Maintaining legacy JSONB columns during transition

## Pre-Migration Checklist

- [ ] **Backup Database**: Create a snapshot or backup of your Supabase database
- [ ] **Review Current Data**: Check counts and sample records
- [ ] **Test in Staging**: Run full migration on staging environment first
- [ ] **Verify API Keys**: Ensure all environment variables are set
- [ ] **Check Disk Space**: Ensure sufficient storage for new tables

## Migration Steps

### Step 1: Create Database Snapshot

```sql
-- In Supabase dashboard, go to Database > Backups
-- Create a manual backup before proceeding
```

Document your backup:
- Backup Date: ________________
- Backup ID: ________________
- Events Count: ________________

### Step 2: Run Migration SQL

1. Navigate to Supabase Dashboard > SQL Editor
2. Open the migration file: `src/database/migrations/001_create_normalized_tables.sql`
3. Copy the entire contents
4. Paste into SQL Editor and execute
5. Verify no errors occurred

Expected results:
- 3 new tables created: `partner_venues`, `partner_artists`, `partner_event_artists`
- `venue_id` column added to `partner_events`
- Multiple indexes created
- Triggers created for timestamp management

Verification query:
```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('partner_venues', 'partner_artists', 'partner_event_artists');

-- Check venue_id column added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'partner_events' 
  AND column_name = 'venue_id';
```

### Step 3: Run Backfill Script

The backfill script migrates existing data from JSONB to normalized tables.

```bash
# Install dependencies if not already installed
npm install

# Run backfill
node src/database/backfill.js
```

The script will:
1. Process all existing events in batches
2. Extract venue data from `venue` JSONB column
3. Extract artist data from `artistlist` JSONB array
4. Create venue records with deduplication
5. Create artist records with deduplication
6. Update `partner_events.venue_id`
7. Populate `partner_event_artists` join table
8. Output progress and statistics

Expected output:
```
[INFO] Starting backfill process...
[INFO] Total events to process: 1234
[INFO] Processing batch: 1 to 100
[INFO] Progress: 100/1234 (98 successful, 2 failed)
...
[INFO] Backfill complete!
[INFO] Total processed: 1234
[INFO] Successful: 1230
[INFO] Failed: 4

=== Validation Statistics ===
Total venues created: 456
Total artists created: 789
Events with venue_id: 1230
Total event-artist mappings: 3456
============================
```

### Step 4: Validate Migration

Run validation queries to ensure data integrity:

```sql
-- 1. Check venue migration
SELECT 
  COUNT(*) as total_events,
  COUNT(venue_id) as events_with_venue_id,
  COUNT(venue) as events_with_venue_json
FROM partner_events;

-- 2. Sample comparison
SELECT 
  id,
  name,
  venue_id,
  venue->>'name' as venue_json_name,
  v.name as venue_table_name
FROM partner_events
LEFT JOIN partner_venues v ON v.id = venue_id
LIMIT 10;

-- 3. Check artist migration
SELECT 
  e.id,
  e.name as event_name,
  COUNT(pea.artist_id) as artist_count_new,
  jsonb_array_length(e.artistlist) as artist_count_legacy
FROM partner_events e
LEFT JOIN partner_event_artists pea ON pea.event_id = e.id
WHERE e.artistlist IS NOT NULL
GROUP BY e.id, e.name, e.artistlist
LIMIT 10;

-- 4. Check for missing venues
SELECT id, name, source
FROM partner_events
WHERE venue IS NOT NULL 
  AND venue_id IS NULL
LIMIT 10;
```

Validation checklist:
- [ ] Venue counts match (events with venue JSON ≈ events with venue_id)
- [ ] Artist counts match (legacy artistlist length ≈ new artist mappings)
- [ ] Sample records show correct relationships
- [ ] No unexpected NULL venue_id where venue JSON exists
- [ ] All tables have expected row counts

### Step 5: Test API Endpoints

Test the updated API to ensure it returns normalized data:

```bash
# Development
curl "http://localhost:8000/api/v1/events/71/chicago" \
  -H "x-api-key: YOUR_API_KEY"

# Production
curl "https://your-app.vercel.app/api/v1/events/71/chicago" \
  -H "x-api-key: YOUR_API_KEY"
```

Expected response structure:
```json
{
  "source": "database",
  "id": 71,
  "city": "chicago",
  "cacheStatus": "fresh",
  "count": 45,
  "data": [
    {
      "id": 12345,
      "name": "Event Name",
      "date": "2025-11-01",
      "venue": {
        "id": "uuid-here",
        "name": "Venue Name",
        "city": "Chicago",
        "state": "IL"
      },
      "artists": [
        {
          "id": "uuid-here",
          "name": "Artist Name"
        }
      ]
    }
  ]
}
```

Validation:
- [ ] Response includes nested `venue` object
- [ ] Response includes `artists` array
- [ ] Venue and artist data is populated correctly
- [ ] No null venue or empty artists for events that should have them

### Step 6: Test Data Ingestion

Trigger a data refresh to ensure the new ingest pipeline works:

```bash
# Using webhook endpoint
curl -X POST "http://localhost:8000/api/webhook/fetch-partner-data" \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"cityId": "71", "cityName": "chicago"}'
```

Or in development mode, the API will automatically trigger background fetches.

Verification:
- [ ] New events are created with venue_id populated
- [ ] Artist relationships are created in partner_event_artists
- [ ] No errors in logs
- [ ] Updated events have correct normalized data

### Step 7: Monitor Performance

Check query performance with indexes:

```sql
-- Explain query plan for events by city
EXPLAIN ANALYZE
SELECT e.*, v.name as venue_name
FROM partner_events e
LEFT JOIN partner_venues v ON v.id = e.venue_id
WHERE e.location_id = 71
ORDER BY e.date;

-- Should show index usage on location_id and date
```

Performance checklist:
- [ ] Query uses `idx_partner_events_city_date` index
- [ ] Response time is acceptable (< 500ms for typical queries)
- [ ] No full table scans on large tables

## Rollback Plan

If issues occur, follow these steps to rollback:

### Option 1: Database Snapshot Restore (Cleanest)

1. Go to Supabase Dashboard > Database > Backups
2. Find the backup created before migration
3. Restore from that backup
4. Verify data is restored correctly

### Option 2: Manual Rollback (Partial)

If you need to keep new data but remove normalized schema:

```sql
-- Remove foreign key constraint
ALTER TABLE partner_events DROP CONSTRAINT IF EXISTS fk_partner_events_venue;

-- Drop new tables (THIS WILL DELETE NORMALIZED DATA)
DROP TABLE IF EXISTS partner_event_artists CASCADE;
DROP TABLE IF EXISTS partner_artists CASCADE;
DROP TABLE IF EXISTS partner_venues CASCADE;

-- Remove venue_id column if desired
ALTER TABLE partner_events DROP COLUMN IF EXISTS venue_id;
```

**Warning**: This only works if you haven't dropped the legacy JSONB columns.

## Post-Migration Tasks

### Optional: Rename Legacy Columns

After validating everything works for 1-2 weeks:

```sql
-- Rename legacy columns for clarity
ALTER TABLE partner_events 
  RENAME COLUMN venue TO venue_legacy;

ALTER TABLE partner_events 
  RENAME COLUMN artistlist TO artistlist_legacy;
```

### Optional: Remove Legacy Columns

Only after extended validation period (30+ days):

```sql
-- ⚠️ PERMANENT: Cannot be undone without backup
ALTER TABLE partner_events DROP COLUMN venue_legacy;
ALTER TABLE partner_events DROP COLUMN artistlist_legacy;
```

## Troubleshooting

### Issue: Backfill fails with "no venue_id updated"

**Cause**: Migration SQL not applied or venue table doesn't exist

**Solution**: 
```sql
-- Check if venue_id column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'partner_events' 
  AND column_name = 'venue_id';
```

If missing, re-run migration SQL.

### Issue: Duplicate venue entries

**Cause**: Venues with different formats of same venue

**Solution**:
```sql
-- Find duplicates
SELECT name, city, COUNT(*) 
FROM partner_venues 
GROUP BY name, city 
HAVING COUNT(*) > 1;

-- Manual cleanup may be needed
```

### Issue: API returns null venue/artists

**Cause**: Incomplete backfill or missing joins

**Solution**:
1. Check logs for errors during backfill
2. Re-run backfill for specific events
3. Verify foreign keys are set correctly

### Issue: Performance degradation

**Cause**: Missing indexes or inefficient queries

**Solution**:
```sql
-- Verify indexes exist
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename IN ('partner_events', 'partner_venues', 'partner_artists');

-- Reindex if needed
REINDEX TABLE partner_events;
```

## Validation Checklist

Before considering migration complete:

- [ ] All migration SQL executed successfully
- [ ] Backfill completed with < 5% failures
- [ ] Venue count matches expectations
- [ ] Artist count matches expectations
- [ ] API returns normalized data correctly
- [ ] New data ingestion works
- [ ] Performance is acceptable
- [ ] Staging environment validated
- [ ] Production migration completed
- [ ] Monitoring shows no errors
- [ ] Legacy columns still present (for rollback)

## Support

For issues or questions:
1. Check logs: Application logs and Supabase logs
2. Review error messages in backfill output
3. Validate SQL in Supabase SQL editor
4. Test in staging before production

## Timeline Recommendation

- **Week 1**: Run migration in staging, validate thoroughly
- **Week 2**: Run migration in production, monitor closely
- **Week 3-4**: Continued monitoring, minor fixes
- **Week 5+**: Consider renaming legacy columns
- **Month 2+**: Consider removing legacy columns (with backup)
