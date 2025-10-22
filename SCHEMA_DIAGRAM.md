# Database Schema Diagram

## Normalized Schema (After Migration)

```
┌─────────────────────────────┐
│     partner_events          │
│─────────────────────────────│
│ id (BIGINT PK)              │
│ source (TEXT)               │
│ name (TEXT)                 │
│ venue_id (UUID FK) ────────┐│
│ location_id (INTEGER)       ││
│ date (DATE)                 ││
│ starttime (TIME)            ││
│ endtime (TIME)              ││
│ link (TEXT)                 ││
│ ages (TEXT)                 ││
│ festivalind (BOOLEAN)       ││
│ livestreamind (BOOLEAN)     ││
│ electronicgenreind (BOOL)   ││
│ othergenreind (BOOLEAN)     ││
│ createddate (TIMESTAMP)     ││
│ venue (JSONB) *legacy*      ││
│ artistlist (JSONB) *legacy* ││
└─────────────────────────────┘│
                               │
        │                      │
        │ Many-to-Many         │
        │ via join table       │
        ↓                      ↓
┌─────────────────────────────┐   ┌──────────────────────────┐
│  partner_event_artists      │   │    partner_venues        │
│─────────────────────────────│   │──────────────────────────│
│ event_id (BIGINT FK) ───────┼──→│ id (UUID PK)             │
│ artist_id (UUID FK) ────┐   │   │ external_id (TEXT UNIQUE)│
│ role (TEXT)             │   │   │ name (TEXT NOT NULL)     │
│ display_order (INTEGER) │   │   │ city (TEXT)              │
│ created_at (TIMESTAMP)  │   │   │ state (TEXT)             │
│ PRIMARY KEY (event_id,  │   │   │ country (TEXT)           │
│              artist_id) │   │   │ address (TEXT)           │
└─────────────────────────┘   │   │ latitude (DOUBLE)        │
                              │   │ longitude (DOUBLE)       │
                              │   │ metadata (JSONB)         │
                              │   │ created_at (TIMESTAMP)   │
                              │   │ updated_at (TIMESTAMP)   │
                              │   └──────────────────────────┘
                              │
                              ↓
                    ┌──────────────────────────┐
                    │   partner_artists        │
                    │──────────────────────────│
                    │ id (UUID PK)             │
                    │ external_id (TEXT UNIQUE)│
                    │ name (TEXT NOT NULL)     │
                    │ metadata (JSONB)         │
                    │ created_at (TIMESTAMP)   │
                    │ updated_at (TIMESTAMP)   │
                    └──────────────────────────┘
```

## Key Relationships

### One-to-Many: Event → Venue
```
partner_events.venue_id → partner_venues.id
```
- Each event has one venue
- Each venue can have many events
- Foreign key with ON DELETE SET NULL

### Many-to-Many: Events ↔ Artists
```
partner_events ← partner_event_artists → partner_artists
```
- Each event can have multiple artists
- Each artist can perform at multiple events
- Join table maintains the relationship
- `display_order` preserves artist order per event

## Indexes

### Performance Indexes
```
partner_events:
├── idx_partner_events_city           (location_id)
├── idx_partner_events_date           (date)
├── idx_partner_events_city_date      (location_id, date)
└── idx_partner_events_venue_id       (venue_id)

partner_venues:
├── idx_partner_venues_external_id    (external_id) UNIQUE
└── idx_partner_venues_name_city      (name, city)

partner_artists:
├── idx_partner_artists_external_id   (external_id) UNIQUE
└── idx_partner_artists_name          (name)

partner_event_artists:
└── idx_partner_event_artists_artist_id (artist_id)
```

## Data Flow (Ingest Pipeline)

```
┌─────────────────┐
│  EDM Train API  │
│  Ticketmaster   │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────────────┐
│   Transform Service                 │
│   (normalizeEdmTrainEvents,         │
│    normalizeTicketmasterEvents)     │
└────────┬────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│   Normalized Data Service           │
│                                     │
│   1. upsertVenue()                  │
│      ↓                              │
│      venue_id                       │
│                                     │
│   2. upsertArtists()                │
│      ↓                              │
│      [artist_ids]                   │
│                                     │
│   3. upsertEvent()                  │
│      with venue_id                  │
│                                     │
│   4. upsertEventArtists()           │
│      event_id + artist_ids          │
└────────┬────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│   Supabase / PostgreSQL             │
│   ✓ partner_venues                  │
│   ✓ partner_artists                 │
│   ✓ partner_events                  │
│   ✓ partner_event_artists           │
└─────────────────────────────────────┘
```

## Query Flow (GET Events)

```
┌─────────────────────────────────────┐
│   GET /api/v1/events/:id/:city      │
└────────┬────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│   normalizedData.getEventsWithRel() │
└────────┬────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│   Query 1: Events with Venue        │
│   SELECT e.*, v.*                   │
│   FROM partner_events e             │
│   LEFT JOIN partner_venues v        │
│   ON e.venue_id = v.id              │
│   WHERE e.location_id = :id         │
└────────┬────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│   Query 2: Artist Mappings          │
│   SELECT pea.event_id, a.*          │
│   FROM partner_event_artists pea    │
│   JOIN partner_artists a            │
│   ON pea.artist_id = a.id           │
│   WHERE pea.event_id IN (...)       │
└────────┬────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│   Merge Results                     │
│   event.venue = { ... }             │
│   event.artists = [ ... ]           │
└────────┬────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│   JSON Response                     │
│   {                                 │
│     data: [                         │
│       {                             │
│         id, name, date,             │
│         venue: { ... },             │
│         artists: [ ... ]            │
│       }                             │
│     ]                               │
│   }                                 │
└─────────────────────────────────────┘
```

## External ID Format

```
Source: EDM Train
Original ID: 12345
External ID: "edmtrain:12345"

Source: Ticketmaster
Original ID: "vvG1zZfr7GkVKx"
External ID: "ticketmaster:vvG1zZfr7GkVKx"
```

This prevents ID collisions across different data sources.

## Migration Path

### Phase 1: Add Normalized Tables
```sql
CREATE TABLE partner_venues ...
CREATE TABLE partner_artists ...
CREATE TABLE partner_event_artists ...
ALTER TABLE partner_events ADD COLUMN venue_id ...
```

### Phase 2: Backfill Data
```
For each event:
  1. Extract venue from JSONB → Insert to partner_venues
  2. Extract artists from JSONB → Insert to partner_artists
  3. Update event.venue_id
  4. Insert to partner_event_artists
```

### Phase 3: Transition Period
```
partner_events contains:
├── venue_id (NEW)
├── venue (LEGACY JSONB)
├── artistlist (LEGACY JSONB)
└── Both normalized and legacy data available
```

### Phase 4: Cleanup (After Validation)
```sql
ALTER TABLE partner_events 
  RENAME COLUMN venue TO venue_legacy;
  
ALTER TABLE partner_events 
  RENAME COLUMN artistlist TO artistlist_legacy;

-- After extended validation (30+ days):
ALTER TABLE partner_events DROP COLUMN venue_legacy;
ALTER TABLE partner_events DROP COLUMN artistlist_legacy;
```

## Benefits of Normalized Schema

1. **Data Consistency**
   - Single source of truth for venues and artists
   - Standardized structure regardless of data source

2. **Deduplication**
   - Same venue across multiple events = one record
   - Same artist across multiple events = one record

3. **Query Performance**
   - Indexed foreign keys for fast joins
   - Composite indexes for common query patterns

4. **Flexibility**
   - Easy to add venue/artist attributes
   - Supports complex queries (e.g., "all events at venue X")
   - Can track artist history across events

5. **Maintainability**
   - Update venue info once, affects all events
   - Update artist info once, affects all events
   - Easier to fix data quality issues

## Example Queries

### Get all events at a specific venue
```sql
SELECT e.* 
FROM partner_events e
JOIN partner_venues v ON e.venue_id = v.id
WHERE v.name = 'Chicago Theatre';
```

### Get all events for a specific artist
```sql
SELECT e.*
FROM partner_events e
JOIN partner_event_artists pea ON e.id = pea.event_id
JOIN partner_artists a ON pea.artist_id = a.id
WHERE a.name = 'Artist Name';
```

### Get venue statistics
```sql
SELECT v.name, v.city, COUNT(e.id) as event_count
FROM partner_venues v
LEFT JOIN partner_events e ON v.id = e.venue_id
GROUP BY v.id, v.name, v.city
ORDER BY event_count DESC;
```

### Get popular artists
```sql
SELECT a.name, COUNT(pea.event_id) as event_count
FROM partner_artists a
JOIN partner_event_artists pea ON a.id = pea.artist_id
GROUP BY a.id, a.name
ORDER BY event_count DESC
LIMIT 10;
```
