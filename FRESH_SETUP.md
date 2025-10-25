# Fresh Setup Guide - New Normalized Schema

This guide explains how to set up the new normalized schema from scratch without any migration.

## Overview

The new schema uses completely new table names:
- `venues` - Stores venue records
- `artists` - Stores artist records  
- `events_v2` - Stores event records with proper foreign keys
- `event_artists` - Join table for event-artist relationships

**Important:** The existing `partner_events` table is **not modified** and remains untouched. Both schemas can coexist.

## Setup Steps

### 1. Create the Tables

1. Open your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open the file: `src/database/schema_new.sql`
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
  AND table_name IN ('venues', 'artists', 'events_v2', 'event_artists')
ORDER BY table_name;
```

You should see all 4 tables listed.

### 3. Start Using the New Schema

The application code is already configured to use the new tables:
- `src/services/normalizedData.js` - Uses new table names
- `src/api/events.js` - Queries from `events_v2` table
- `src/jobs/fetchPartnerData.js` - Inserts into new tables

### 4. Test the Setup

Start the development server:
```bash
npm run dev
```

The system will now:
- Fetch data from EDM Train and Ticketmaster
- Store venues in `venues` table
- Store artists in `artists` table
- Store events in `events_v2` table with proper relationships
- Create event-artist mappings in `event_artists` table

### 5. Query the Data

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

### venues
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

### artists
```sql
- id (UUID, primary key)
- external_id (TEXT, unique)
- name (TEXT)
- metadata (JSONB)
- created_at, updated_at (TIMESTAMP)
```

### events_v2
```sql
- id (BIGINT, primary key)
- source (TEXT)
- name (TEXT)
- venue_id (UUID, FK to venues)
- location_id (INTEGER)
- date (DATE)
- starttime, endtime (TIME)
- link, ages (TEXT)
- festivalind, livestreamind, electronicgenreind, othergenreind (BOOLEAN)
- createddate, created_at, updated_at (TIMESTAMP)
```

### event_artists
```sql
- event_id (BIGINT, FK to events_v2)
- artist_id (UUID, FK to artists)
- role (TEXT)
- display_order (INTEGER)
- created_at (TIMESTAMP)
- PRIMARY KEY (event_id, artist_id)
```

## Benefits of This Approach

1. **No Migration Needed** - Fresh start with clean schema
2. **No Data Loss Risk** - Existing `partner_events` table untouched
3. **Parallel Operation** - Both systems can run simultaneously
4. **Clean Architecture** - Proper normalization from day one
5. **Easy Testing** - Can validate new schema before switching over

## Coexistence with Old Schema

The new and old schemas can run side-by-side:

- **Old schema:** `partner_events` (with JSONB venue/artistlist)
- **New schema:** `events_v2`, `venues`, `artists`, `event_artists`

You can:
- Keep the old schema as backup
- Run queries against both for comparison
- Gradually transition API endpoints
- Eventually deprecate the old schema when ready

## Next Steps

1. **Create the tables** using `schema_new.sql`
2. **Start the application** - it will begin populating new tables
3. **Monitor the data** - check tables are being populated correctly
4. **Validate responses** - ensure API returns proper nested data
5. **Optional:** Keep old `partner_events` as historical backup

## Troubleshooting

### Tables not created
- Ensure you have proper permissions in Supabase
- Check for SQL syntax errors in the execution log

### Foreign key errors
- Ensure all tables are created successfully
- Check that `venues` and `artists` tables exist before `events_v2`

### No data appearing
- Check application logs for errors
- Verify environment variables are set correctly
- Ensure API keys for EDM Train and Ticketmaster are valid

## Support

For questions:
- Check application logs for detailed error messages
- Verify SQL execution completed without errors
- Test with a simple location first (e.g., Chicago)

This fresh setup approach avoids all migration complexity and gives you a clean, normalized schema from the start!
