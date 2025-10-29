# Genre Implementation - Quick Reference

> **Companion document to `GENRE_IMPLEMENTATION_PLAN.md`**  
> For full details, see the comprehensive implementation plan.

---

## TL;DR

Add music genre classification to Events API:
- 3 new tables: `prtnr_genres`, `prtnr_genre_subgenres`, `prtnr_event_genres`
- Ticketmaster Discovery API for genre data
- Music segment only (no Comedy, Sports, etc.)
- Many-to-many event ↔ genre relationships

---

## Quick Start Commands

```bash
# 1. Apply database migration
# Run in Supabase SQL Editor: src/database/migrations/002_add_genres.sql

# 2. Bootstrap genres from Ticketmaster
npm run genres:bootstrap

# 3. Backfill existing events
npm run genres:backfill

# 4. Start development server
npm run dev
```

---

## Database Schema (3 Tables)

### prtnr_genres (Master List)
```sql
id                       UUID PRIMARY KEY
name                     TEXT NOT NULL
normalized_name          TEXT (lowercase slug)
ticketmaster_genre_id    TEXT UNIQUE
ticketmaster_segment_id  TEXT
description              TEXT
metadata                 JSONB
created_at, updated_at   TIMESTAMP
```

### prtnr_event_genres (Join Table)
```sql
id                                UUID PRIMARY KEY
event_id                          BIGINT → prtnr_events(id)
genre_id                          UUID → prtnr_genres(id)
classification_primary            BOOLEAN
ticketmaster_classification_json  JSONB
created_at                        TIMESTAMP
UNIQUE(event_id, genre_id)
```

### prtnr_genre_subgenres (Optional)
```sql
id                         UUID PRIMARY KEY
genre_id                   UUID → prtnr_genres(id)
name                       TEXT NOT NULL
normalized_name            TEXT
ticketmaster_subgenre_id   TEXT UNIQUE
created_at                 TIMESTAMP
```

---

## Key Files to Create

### Database
- `src/database/migrations/002_add_genres.sql` - Migration
- `src/database/rollbacks/002_rollback_genres.sql` - Rollback

### Services
- `src/services/ticketmasterGenres.ts` - Discovery API client
- `src/services/genres.ts` - Genre management service

### Jobs
- `src/jobs/bootstrapGenres.ts` - Initial genre import
- `src/jobs/backfillEventGenres.ts` - Map existing events

### API
- `src/api/genres.ts` - Genre endpoints

### Types
- Update `src/types/index.ts` - Add Genre interfaces

---

## API Endpoints (New)

```
GET  /api/genres              - List all genres
GET  /api/genres/:id/events   - Get events for a genre
GET  /api/genres/stats        - Genre statistics
```

---

## Ticketmaster API Usage

**Discovery API Classifications Endpoint:**
```
GET https://app.ticketmaster.com/discovery/v2/classifications.json
  ?segmentName=Music
  &apikey=YOUR_KEY
```

**Event Classification Data:**
```json
{
  "classifications": [
    {
      "primary": true,
      "segment": { "id": "KZFzniwnSyZfZ7v7nJ", "name": "Music" },
      "genre": { "id": "KnvZfZ7vAvF", "name": "Dance/Electronic" },
      "subGenre": { "id": "KZazBEonSMnZfZ7vFd1", "name": "House" }
    }
  ]
}
```

**Filter Music Only:**
```typescript
classifications.filter(c => c.segment?.name === "Music")
```

---

## Example Queries

### Get events with genres
```sql
SELECT e.name, g.name as genre, eg.classification_primary
FROM prtnr_events e
JOIN prtnr_event_genres eg ON e.id = eg.event_id
JOIN prtnr_genres g ON eg.genre_id = g.id
WHERE e.source = 'ticketmaster'
ORDER BY e.date DESC
LIMIT 20;
```

### Get primary genre per event
```sql
SELECT e.name, g.name as primary_genre
FROM prtnr_events e
LEFT JOIN prtnr_event_genres eg ON e.id = eg.event_id 
  AND eg.classification_primary = true
LEFT JOIN prtnr_genres g ON eg.genre_id = g.id
WHERE e.source = 'ticketmaster';
```

### Find unmapped events
```sql
SELECT COUNT(*) as unmapped_count
FROM prtnr_events e
LEFT JOIN prtnr_event_genres eg ON e.id = eg.event_id
WHERE e.source = 'ticketmaster' AND eg.event_id IS NULL;
```

---

## Key Code Patterns

### Normalize Genre Name
```typescript
const normalizeGenreName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};
```

### Upsert Genre
```typescript
await genreService.upsertGenre({
  name: "Dance/Electronic",
  ticketmaster_genre_id: "KnvZfZ7vAvF",
  ticketmaster_segment_id: "KZFzniwnSyZfZ7v7nJ",
});
```

### Map Event Genres
```typescript
const musicClassifications = event.classifications.filter(
  c => c.segment?.name === "Music"
);

await genreService.mapEventGenres(eventId, musicClassifications);
```

---

## Monitoring Metrics

**Track these in production:**

1. **Genre coverage**: % of events with genres
   - Target: > 95% for Ticketmaster events
   
2. **Unmapped events**: Events without genre mappings
   - Target: < 5%
   
3. **Genre distribution**: Top 10 genres by event count
   - Useful for analytics and filtering

---

## Testing Checklist

- [ ] Genre normalization works correctly
- [ ] Music-only filter excludes non-music segments
- [ ] Genre upsert handles duplicates
- [ ] Event-genre mapping creates relationships
- [ ] Primary genre flag is preserved
- [ ] Bootstrap imports all genres
- [ ] Backfill maps existing events

---

## Rollback Procedure

If issues arise:

```sql
-- Run rollback script
\i src/database/rollbacks/002_rollback_genres.sql

-- This drops:
-- - prtnr_event_genres
-- - prtnr_genre_subgenres
-- - prtnr_genres
```

No data loss in `prtnr_events` - genres are additive only.

---

## Common Issues & Solutions

**Issue**: Genres not appearing for events  
**Solution**: Check if classifications exist in event metadata, verify music segment filter

**Issue**: Duplicate genre error  
**Solution**: Check for existing genre with same `ticketmaster_genre_id`

**Issue**: Low genre coverage  
**Solution**: Run backfill job, check Ticketmaster API response for classifications

**Issue**: Bootstrap fails  
**Solution**: Verify Ticketmaster API key, check Discovery API rate limits

---

## Next Steps After Implementation

1. ✅ Verify all migrations applied successfully
2. ✅ Bootstrap genres from Ticketmaster
3. ✅ Backfill existing events
4. ✅ Monitor genre coverage metrics
5. ✅ Update API documentation
6. ✅ Add genre filters to event queries
7. ✅ Consider adding genre-based recommendations

---

## Resources

- **Full Plan**: `GENRE_IMPLEMENTATION_PLAN.md` (1300+ lines)
- **Issue**: #13
- **Related PR**: #8 (Normalized Schema)
- **Ticketmaster Docs**: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/

---

**Document Version**: 1.0  
**Last Updated**: October 29, 2025  
**Quick Reference For**: Implementation Plan v1.0
