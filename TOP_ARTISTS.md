# Top Artists Feature

This feature provides endpoints to query and calculate the top touring artists based on event data.

## Overview

The top artists feature analyzes event-artist relationships to identify the most active touring artists. It provides two key metrics:

1. **Total Shows**: The total number of events/performances for each artist
2. **Unique Cities**: The number of unique cities where an artist has performed

The system maintains a pre-calculated table (`prtnr_top_artists`) with the top 200 artists, updated weekly for optimal performance.

## Database Schema

### Table: `prtnr_top_artists`

```sql
CREATE TABLE prtnr_top_artists (
  id UUID PRIMARY KEY,
  artist_id UUID REFERENCES prtnr_artists(id),
  artist_name TEXT NOT NULL,
  total_shows INTEGER NOT NULL,
  unique_cities INTEGER NOT NULL,
  rank_by_shows INTEGER,
  rank_by_cities INTEGER,
  last_calculated TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### Setup Instructions

Run the schema creation SQL in your Supabase SQL Editor:

```bash
src/database/top_artists_schema.sql
```

This will create:
- The `prtnr_top_artists` table
- Indexes for efficient querying
- Unique constraint on `artist_id`

## API Endpoints

### 1. Get Top Artists (Public API)

**Endpoint**: `GET /api/v1/top-artists`

**Authentication**: API Key required

**Query Parameters**:
- `sort_by` (optional): `"shows"` or `"cities"` - Default: `"shows"`
- `limit` (optional): Number (1-200) - Default: 200

**Examples**:

```bash
# Get top 50 artists by total shows
curl -H "x-api-key: YOUR_API_KEY" \
  "https://your-domain.com/api/v1/top-artists?sort_by=shows&limit=50"

# Get top 100 artists by unique cities
curl -H "x-api-key: YOUR_API_KEY" \
  "https://your-domain.com/api/v1/top-artists?sort_by=cities&limit=100"
```

**Response Format**:

```json
{
  "data": [
    {
      "id": "uuid",
      "artist_id": "uuid",
      "artist_name": "Artist Name",
      "total_shows": 150,
      "unique_cities": 45,
      "rank_by_shows": 1,
      "rank_by_cities": 3,
      "last_calculated": "2025-11-19T10:00:00Z",
      "created_at": "2025-11-19T10:00:00Z",
      "updated_at": "2025-11-19T10:00:00Z"
    }
  ],
  "count": 50,
  "last_updated": "2025-11-19T10:00:00Z",
  "sort_by": "shows"
}
```

### 2. Calculate Top Artists (Webhook)

**Endpoint**: `POST /api/webhook/calculate-top-artists`

**Authentication**: WEBHOOK_SECRET required

**Purpose**: Recalculates top artists from current event data. Designed to run weekly via scheduled job.

**Example**:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  https://your-domain.com/api/webhook/calculate-top-artists
```

**Response**:

```json
{
  "success": true,
  "message": "Top artists calculation completed successfully",
  "duration": "1234ms",
  "timestamp": "2025-11-19T10:00:00Z"
}
```

## Manual Calculation

You can manually trigger the top artists calculation using npm:

```bash
npm run calculate-top-artists
```

This is useful for:
- Initial setup
- Testing
- Ad-hoc recalculations

## Scheduled Updates

For production use, set up a weekly cron job or scheduled webhook to run the calculation:

### Vercel Cron (Recommended)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/webhook/calculate-top-artists",
      "schedule": "0 0 * * 0"
    }
  ]
}
```

This runs every Sunday at midnight UTC.

### External Cron Services

Use services like:
- **GitHub Actions**: Schedule a workflow
- **Zapier**: Create a scheduled webhook
- **EasyCron**: Set up a weekly HTTP request

Example GitHub Actions workflow:

```yaml
name: Calculate Top Artists
on:
  schedule:
    - cron: '0 0 * * 0'  # Every Sunday at midnight

jobs:
  calculate:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger webhook
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.WEBHOOK_SECRET }}" \
            https://your-domain.com/api/webhook/calculate-top-artists
```

## How It Works

### Calculation Process

1. **Fetch Data**: Queries `prtnr_event_artists` and `prtnr_events` tables
2. **Aggregate**: Groups by artist and counts:
   - Total events per artist
   - Unique location_ids (cities) per artist
3. **Rank**: Sorts artists by both metrics
4. **Store**: Replaces all data in `prtnr_top_artists` with top 200 artists
5. **Return**: Fast queries against pre-calculated data

### Performance Characteristics

- **Calculation**: ~1-3 seconds for typical datasets
- **Query**: <100ms for top artists retrieval
- **Serverless-friendly**: Designed for stateless environments
- **Efficient**: Single batch operations, minimal database round trips

## Data Sources

The calculation uses data from:
- **prtnr_events**: Event records with location_id
- **prtnr_event_artists**: Many-to-many relationships
- **prtnr_artists**: Artist names and metadata

Events are counted regardless of:
- Past vs. future dates
- Event source (EDM Train, Ticketmaster, etc.)
- Location (all cities included)

## Monitoring

### Check Last Update

Query the database directly:

```sql
SELECT 
  MAX(last_calculated) as last_update,
  COUNT(*) as total_artists
FROM prtnr_top_artists;
```

### Webhook Logs

Check your serverless platform logs for calculation status:
- Search for "top artists calculation"
- Monitor duration and success/failure

## Troubleshooting

### No Data Returned

**Issue**: `/api/v1/top-artists` returns empty data

**Solutions**:
1. Run initial calculation: `npm run calculate-top-artists`
2. Verify database has event-artist data
3. Check webhook logs for errors

### Calculation Fails

**Issue**: Webhook returns 500 error

**Solutions**:
1. Check database connection
2. Verify `prtnr_top_artists` table exists
3. Ensure sufficient event-artist data exists
4. Review application logs

### Stale Data

**Issue**: Data hasn't updated in over a week

**Solutions**:
1. Verify cron job is configured correctly
2. Check webhook authentication
3. Manually trigger calculation
4. Review scheduled job logs

## API Rate Limits

Same as other authenticated endpoints:
- Use API key for authentication
- Standard rate limiting applies
- Consider caching responses on client side

## Future Enhancements

Potential improvements:
- Filter by date range (last 6 months, year, etc.)
- Filter by genre or location
- Include trend data (rising/falling artists)
- Artist metadata (images, links, etc.)
- Historical rankings over time
