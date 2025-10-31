# Fresh Setup Guide - Normalized Events Schema

This guide explains how to set up the normalized event schema from scratch.

## Overview

The normalized schema uses the `prtnr_` prefix for all tables:
- `prtnr_venues` - Stores venue records
- `prtnr_artists` - Stores artist records  
- `prtnr_events` - Stores event records with proper foreign keys
- `prtnr_event_artists` - Join table for event-artist relationships

**Important:** The existing `partner_events` table is **not modified** and remains untouched. Both schemas can coexist.

## Setup Steps

### 1. Create the Database Tables

1. Open your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open the file: `src/database/schema.sql`
4. Copy the entire contents
5. Paste into SQL Editor
6. Click **Run** to execute

This will create:
- 4 new tables with proper schema
- All foreign key constraints
- Performance indexes
- Automatic timestamp triggers

### 2. Verify Tables Created

Run this query in SQL Editor to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('prtnr_venues', 'prtnr_artists', 'prtnr_events', 'prtnr_event_artists')
ORDER BY table_name;
```

You should see all 4 tables listed.

### 3. Start Using the Schema

The application code is configured to use these tables:
- `src/services/normalizedData.js` - Handles all data operations
- `src/api/events.js` - Queries from `prtnr_events` table
- `src/jobs/fetchPartnerData.js` - Inserts into new tables

Simply start the development server:
```bash
npm run dev
```

The system will now:
- Fetch data from EDM Train and Ticketmaster
- Store venues in `prtnr_venues` table
- Store artists in `prtnr_artists` table
- Store events in `prtnr_events` table with proper relationships
- Create event-artist mappings in `prtnr_event_artists` table

### 4. Test the API

Test the API endpoint:
```bash
curl "http://localhost:8000/api/v1/events/71/chicago" \
  -H "x-api-key: YOUR_API_KEY"
```

Expected response with normalized data:
```json
{
  "source": "database",
  "id": 71,
  "city": "chicago",
  "count": 45,
  "data": [
    {
      "id": 12345,
      "name": "Event Name",
      "venue": {
        "id": "uuid",
        "name": "Venue Name",
        "city": "Chicago",
        "state": "IL"
      },
      "artists": [
        {
          "id": "uuid",
          "name": "Artist Name"
        }
      ]
    }
  ]
}
```

## Table Schemas

### prtnr_venues
```sql
- id (UUID, primary key)
- external_id (TEXT, unique)
- name (TEXT)
- city, state, country (TEXT)
- address (TEXT)
- latitude, longitude (DOUBLE PRECISION)
- metadata (JSONB)
- created_at, updated_at (TIMESTAMP)
```

### prtnr_artists
```sql
- id (UUID, primary key)
- external_id (TEXT, unique)
- name (TEXT)
- metadata (JSONB)
- created_at, updated_at (TIMESTAMP)
```

### prtnr_events
```sql
- id (BIGINT, primary key)
- source (TEXT)
- name (TEXT)
- venue_id (UUID, FK to prtnr_venues)
- location_id (INTEGER)
- date (DATE)
- starttime, endtime (TIME)
- link, ages (TEXT)
- festivalind, livestreamind, electronicgenreind, othergenreind (BOOLEAN)
- createddate, created_at, updated_at (TIMESTAMP)
```

### prtnr_event_artists
```sql
- event_id (BIGINT, FK to prtnr_events)
- artist_id (UUID, FK to prtnr_artists)
- role (TEXT)
- display_order (INTEGER)
- created_at (TIMESTAMP)
- PRIMARY KEY (event_id, artist_id)
```

## Performance Features

### Indexes
- Unique indexes on `external_id` fields for fast upserts
- Composite index on `location_id, date` for common query pattern
- Foreign key indexes for efficient joins

### Expected Performance
- City queries with <1000 events: **<200ms**
- City queries with 1000-5000 events: **<500ms**

## Troubleshooting

### Tables not created
- Ensure you have proper permissions in Supabase
- Check for SQL syntax errors in the execution log

### Foreign key errors
- Ensure all tables are created successfully
- Check that `prtnr_venues` and `prtnr_artists` tables exist before `prtnr_events`

### No data appearing
- Check application logs for errors
- Verify environment variables are set correctly
- Ensure API keys for EDM Train and Ticketmaster are valid

## Benefits

✅ **No Migration Required** - Clean start with new tables
✅ **Zero Risk** - Existing data completely untouched
✅ **Parallel Operation** - Both old and new schemas coexist
✅ **Easy Setup** - Just run one SQL file
✅ **Clean Architecture** - Proper normalization from day one

## Support

For questions:
- Check `src/database/README.md` for database details
- Check `SQL_REFERENCE.md` for SQL commands
- Review application logs for detailed error messages
