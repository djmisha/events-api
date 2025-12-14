# Artists Feature Documentation

## Overview

The Artists feature provides a comprehensive artist database that aggregates data from multiple event sources (EDM Train and Ticketmaster). This master artist table serves as a centralized repository for artist information, enabling consistent artist data across the application.

## Key Features

- **Master Artist Database**: Centralized storage for artist information
- **Multi-Source Integration**: Supports both EDM Train and Ticketmaster external IDs
- **Automatic Sync**: Background job to sync new artists from partner events
- **Deduplication**: Intelligent matching to prevent duplicate entries
- **Data Enrichment**: Fills in missing data when more information becomes available
- **Append-Only Design**: Artists are never deleted, only added or updated

## Database Schema

### Artists Table

```sql
CREATE TABLE artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    image TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    ticketmaster_id VARCHAR(255),
    edmtrain_id INTEGER,
    bio TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `name` | VARCHAR(255) | Artist display name |
| `slug` | VARCHAR(255) | URL-friendly identifier (unique) |
| `image` | TEXT | URL to artist image |
| `tags` | JSONB | Array of genre/style tags |
| `ticketmaster_id` | VARCHAR(255) | External Ticketmaster attraction ID |
| `edmtrain_id` | INTEGER | External EDM Train artist ID |
| `bio` | TEXT | Artist biography/description |
| `metadata` | JSONB | Additional metadata |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time (auto-updated) |

### SQL Commands

To create the artists table, run the SQL file:

```bash
# In Supabase SQL Editor, execute:
src/database/artists_schema.sql
```

### Related Partner Tables

The artist sync process works with data from the normalized partner event schema:

- **`prtnr_artists`** - Stores artist records from partner APIs (EDM Train, Ticketmaster) with external IDs
- **`prtnr_events`** - Event records from partner APIs
- **`prtnr_event_artists`** - Junction table linking events to artists (many-to-many relationship)
- **`prtnr_venues`** - Venue records from partner APIs

The master `artists` table aggregates and deduplicates data from `prtnr_artists`, creating a unified artist database across all sources.

## API Endpoints

All artist endpoints require API key authentication.

### List All Artists

```
GET /api/v1/artists
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 50, max: 100)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Deadmau5",
      "slug": "deadmau5",
      "image": "https://...",
      "tags": ["house", "progressive-house"],
      "ticketmaster_id": "K8vZ917Gku7",
      "edmtrain_id": 1001,
      "bio": "...",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1,
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

### Search Artists by Name

```
GET /api/v1/artists/search?q=deadmau5
```

**Query Parameters:**
- `q` (required): Search query
- `limit` (optional): Max results (default: 10, max: 50)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Deadmau5",
      "slug": "deadmau5",
      ...
    }
  ],
  "count": 1,
  "message": "Found 1 artist(s) matching \"deadmau5\""
}
```

### Get Artist by Identifier

```
GET /api/v1/artists/:identifier
```

The identifier can be:
- **UUID**: `550e8400-e29b-41d4-a716-446655440000`
- **Slug**: `deadmau5`
- **External ID**: `edmtrain:1001` or `ticketmaster:K8vZ917Gku7`
- **Name**: `Deadmau5` (will match closest result)

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Deadmau5",
    "slug": "deadmau5",
    ...
  },
  "count": 1,
  "message": "Artist found"
}
```

## Background Jobs

### Automatic Artist Sync (Integrated with Partner Data Fetch)

Artists are automatically synchronized to the master `artists` table during the partner data fetch process. This happens immediately after events are fetched and stored, ensuring the artist database stays up-to-date with minimal overhead.

**How it works:**
- Runs automatically as part of `/api/webhook/fetch-partner-data`
- **Performance Optimization**: Only syncs artists that were **newly inserted** into `prtnr_artists` table (not all artists from events)
- This dramatically reduces redundant processing by avoiding re-syncing thousands of existing artists on every refresh
- Processes all relevant artists in a single optimized batch operation (3 queries total instead of N)
- Matches by external ID or name to prevent duplicates
- Updates existing artists with new data if available (fills in missing external IDs)
- Never deletes existing artist records (append-only design)

**Benefits:**
- Highly efficient: Only syncs new artists (typically 0-10 per refresh vs hundreds)
- Batch operations reduce database queries by ~95% (3 queries vs N individual lookups)
- No separate webhook call needed
- Artists are immediately available after events are fetched
- Scales well for large datasets (tested with 100+ events)

## Data Flow

```
┌─────────────────┐    ┌─────────────────┐
│   EDM Train     │    │  Ticketmaster   │
│     API         │    │      API        │
└────────┬────────┘    └────────┬────────┘
         │                      │
         │  Partner Data Fetch  │
         │  (fetchPartnerData)  │
         ▼                      ▼
┌─────────────────────────────────────────┐
│     Normalized Event Processing         │
│  - Transform events                     │
│  - Upsert to prtnr_events               │
│  - Upsert to prtnr_venues               │
│  - Upsert to prtnr_artists              │
│  - Upsert to prtnr_event_artists        │
│  - Track newly-inserted artist IDs      │
└────────────────────┬────────────────────┘
                     │
                     │ Automatic Artist Sync
                     │ (syncArtistsFromEvents)
                     │ ← Only for NEW partner artists
                     │ ← Integrated in same job
                     ▼
┌─────────────────────────────────────────┐
│              artists                    │
│      (Master Artists Table)             │
│  - Deduplication by external ID         │
│  - Data Enrichment (fill missing)       │
│  - Append-only (never delete)           │
│  - Batch processing (3 queries total)   │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│         /api/v1/artists                 │
│      (Artist API Endpoint)              │
└─────────────────────────────────────────┘
```

**Key Points:**
- Artists are synced **during** partner data fetch, not as a separate job
- **Performance Optimization**: Only newly-inserted partner artists are synced (not all artists from events)
- This avoids re-checking thousands of existing artists on every refresh
- Typically syncs 0-10 new artists per refresh instead of hundreds of existing ones
- Uses batch operations for maximum efficiency (3 database queries vs N individual lookups)
- More efficient and scalable approach that reduces database load by ~95%

## Deduplication Logic

When syncing artists, the system follows this logic:

1. **Check by External ID**: First, look for an existing artist with the same EDM Train or Ticketmaster ID
2. **Check by Name**: If not found by ID, search for an exact name match (case-insensitive)
3. **Create or Update**:
   - If found and has new data → Update existing record
   - If found but no new data → Skip
   - If not found → Create new record

### Data Priority

When updating an existing artist:
- Existing data is preserved (never overwritten with null/empty)
- New data fills in blank fields
- Arrays (tags) are replaced only if the new array is not empty
- External IDs from both sources can coexist on the same artist

## Configuration

### Environment Variables

No additional environment variables are required. The artists feature uses the existing Supabase configuration:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
```

## Best Practices

1. **Automatic Sync**: Artists are automatically synced during partner data fetch - no manual intervention needed
2. **Efficient Processing**: The sync process only processes newly-inserted partner artists, making it extremely efficient even for large datasets
3. **Use External IDs**: Always use external IDs (edmtrain_id, ticketmaster_id) when available for reliable matching
4. **Monitor Sync Results**: Check the sync results in logs to identify data quality issues (typically shows 0-10 new artists per refresh)
5. **Batch Operations**: The sync uses optimized batch operations (3 queries total) instead of individual artist lookups

## Error Handling

- Individual artist processing errors don't stop the sync job
- Errors are logged and counted in the sync result
- The API returns appropriate HTTP status codes:
  - 200: Success
  - 400: Bad request (missing parameters)
  - 401: Unauthorized (invalid API key)
  - 404: Artist not found
  - 500: Internal server error
