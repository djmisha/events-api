# API Changes - Normalized Schema

This document describes the changes to the API responses and data ingestion after the schema normalization.

## Overview

The API has been updated to return normalized venue and artist data instead of JSONB objects. This provides better data consistency, relationship management, and query performance.

## Response Format Changes

### Before (Legacy JSONB Format)

```json
{
  "source": "database",
  "id": 71,
  "city": "chicago",
  "cacheStatus": "fresh",
  "count": 2,
  "data": [
    {
      "id": 12345,
      "name": "Event Name",
      "date": "2025-11-01",
      "starttime": "20:00:00",
      "venue": {
        "id": 123,
        "name": "Venue Name",
        "location": "Chicago, IL"
      },
      "artistlist": [
        {
          "id": 456,
          "name": "Artist Name",
          "link": "https://..."
        }
      ]
    }
  ]
}
```

### After (Normalized Format)

```json
{
  "source": "database",
  "id": 71,
  "city": "chicago",
  "cacheStatus": "fresh",
  "count": 2,
  "data": [
    {
      "id": 12345,
      "name": "Event Name",
      "date": "2025-11-01",
      "starttime": "20:00:00",
      "venue_id": "550e8400-e29b-41d4-a716-446655440000",
      "venue": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "external_id": "edmtrain:123",
        "name": "Venue Name",
        "city": "Chicago",
        "state": "IL",
        "country": "USA",
        "address": "123 Main St",
        "latitude": 41.8781,
        "longitude": -87.6298,
        "metadata": {},
        "created_at": "2025-10-01T12:00:00Z",
        "updated_at": "2025-10-01T12:00:00Z"
      },
      "artists": [
        {
          "id": "660e8400-e29b-41d4-a716-446655440001",
          "external_id": "edmtrain:456",
          "name": "Artist Name",
          "metadata": {
            "link": "https://..."
          },
          "created_at": "2025-10-01T12:00:00Z",
          "updated_at": "2025-10-01T12:00:00Z"
        }
      ]
    }
  ]
}
```

## Key Differences

### 1. Venue Data

**Before:**
- `venue` was a JSONB object embedded in the event
- Structure varied by data source
- No relationships or deduplication

**After:**
- `venue` is a full object from `partner_venues` table
- `venue_id` is a UUID foreign key
- Venues are deduplicated across events
- Consistent structure regardless of source
- Includes `external_id` for source tracking

### 2. Artist Data

**Before:**
- `artistlist` was a JSONB array embedded in the event
- No relationships or deduplication

**After:**
- `artists` is an array of full objects from `partner_artists` table
- Artists are deduplicated across events
- Relationships managed via `partner_event_artists` join table
- Preserves display order
- Includes `external_id` for source tracking

### 3. Data Types

**Before:**
- Venue ID: Could be number or string
- Artist ID: Could be number or string
- No consistent identification

**After:**
- Venue ID: UUID (standardized)
- Artist ID: UUID (standardized)
- External ID: String with source prefix (e.g., "edmtrain:123", "ticketmaster:xyz")

## Backward Compatibility

During the transition period:
- Legacy JSONB columns (`venue`, `artistlist`) are **retained** in the database
- Old API clients will continue to see these fields
- New API clients will see both legacy and normalized fields
- Once validated, legacy columns can be renamed to `*_legacy`

## Data Ingestion Changes

### Before

Events were inserted with venue and artists as JSONB:

```javascript
{
  id: 12345,
  venue: { id: 123, name: "Venue Name" },
  artistlist: [{ id: 456, name: "Artist Name" }]
}
```

### After

Events are inserted with normalized relationships:

1. **Venue Upsert**: Venue data is upserted to `partner_venues`
2. **Artist Upsert**: Each artist is upserted to `partner_artists`
3. **Event Insert**: Event is inserted with `venue_id` foreign key
4. **Mapping Insert**: Event-artist relationships in `partner_event_artists`

All operations are wrapped in transactional logic to ensure consistency.

## External ID Format

To prevent collisions between data sources, external IDs use a prefix:

- EDM Train: `edmtrain:{original_id}`
- Ticketmaster: `ticketmaster:{original_id}`

Example:
- EDM Train venue ID 123 → `edmtrain:123`
- Ticketmaster venue ID abc → `ticketmaster:abc`

## Query Performance

### Indexes Added

The following indexes optimize common query patterns:

1. `idx_partner_events_city` - Single city lookups
2. `idx_partner_events_date` - Date-based filtering
3. `idx_partner_events_city_date` - Combined city + date queries (most common)
4. `idx_partner_events_venue_id` - Join optimization
5. `idx_partner_venues_external_id` - Upsert optimization
6. `idx_partner_artists_external_id` - Upsert optimization

### Expected Performance

- City queries with < 1000 events: **< 200ms**
- City queries with 1000-5000 events: **< 500ms**
- Venue joins: **No additional overhead** (indexed FK)
- Artist joins: **Linear with artist count** (optimized query)

## Migration Timeline

### Phase 1: Migration (Week 1)
- ✓ Create new tables
- ✓ Add foreign keys and indexes
- ✓ Run backfill
- ✓ Validate data

### Phase 2: Transition (Weeks 2-4)
- Both legacy and normalized data available
- Monitor API responses
- Validate client compatibility
- Fix any issues

### Phase 3: Cleanup (Week 5+)
- Rename legacy columns to `*_legacy`
- Update documentation
- Monitor for issues

### Phase 4: Removal (Month 2+)
- Drop legacy columns (with backup)
- Complete migration

## Client Migration Guide

### For API Consumers

If you're consuming the events API:

1. **Update response parsing** to handle both formats during transition
2. **Use `venue.id` (UUID)** instead of `venue.id` (number) for identification
3. **Use `artists` array** instead of `artistlist` array
4. **Access nested fields** like `venue.city` instead of parsing `venue.location`
5. **Test thoroughly** before legacy columns are removed

### Example Code Update

Before:
```javascript
const event = response.data[0];
const venueName = event.venue?.name;
const artistNames = event.artistlist?.map(a => a.name) || [];
```

After:
```javascript
const event = response.data[0];
const venueName = event.venue?.name;
const artistNames = event.artists?.map(a => a.name) || [];
// venue.city, venue.state now available as separate fields
const venueCity = event.venue?.city;
```

## Troubleshooting

### Issue: Events missing venue data

**Check:**
```sql
SELECT id, name, venue_id, venue
FROM partner_events
WHERE venue IS NOT NULL AND venue_id IS NULL
LIMIT 10;
```

**Fix:** Re-run backfill for affected events

### Issue: Events missing artists

**Check:**
```sql
SELECT e.id, e.name, 
       COUNT(pea.artist_id) as artist_count,
       jsonb_array_length(e.artistlist) as legacy_count
FROM partner_events e
LEFT JOIN partner_event_artists pea ON pea.event_id = e.id
WHERE e.artistlist IS NOT NULL
GROUP BY e.id
HAVING COUNT(pea.artist_id) = 0;
```

**Fix:** Re-run backfill for affected events

### Issue: Duplicate venues

**Check:**
```sql
SELECT name, city, COUNT(*)
FROM partner_venues
GROUP BY name, city
HAVING COUNT(*) > 1;
```

**Fix:** Manual deduplication may be needed

## Questions?

For issues or questions:
1. Check MIGRATION_GUIDE.md for detailed migration steps
2. Review application logs for errors
3. Validate data using `npm run validate`
4. Check Supabase logs for database errors
