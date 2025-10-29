# Genre Classification Feature - README Addition

> **Copy this section into the main README.md when implementing the genre feature**

---

## 🎵 Genre Classification

The Events API supports **music genre classification** for events from Ticketmaster using the Discovery API.

### Features

- 🎸 **Music-Only Focus**: Filters to music segment only (excludes Comedy, Sports, Theatre)
- 🏷️ **Hierarchical Genres**: Genre and subgenre support (e.g., Electronic → House)
- 🔗 **Many-to-Many**: Events can have multiple genres
- 🔄 **Auto-Sync**: Genres automatically assigned during event ingestion
- 📊 **Rich API**: Query events by genre, view genre statistics

### Database Schema

Three new tables added:
- `prtnr_genres` - Master list of music genres
- `prtnr_genre_subgenres` - Subgenre hierarchy (optional)
- `prtnr_event_genres` - Event-genre mappings

### API Endpoints

```http
GET /api/genres                 # List all genres
GET /api/genres/:id/events      # Get events for a genre
GET /api/genres/stats           # Genre coverage statistics
```

### Example Response

```json
{
  "genres": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Dance/Electronic",
      "normalized_name": "dance-electronic",
      "ticketmaster_genre_id": "KnvZfZ7vAvF"
    }
  ]
}
```

### Setup

1. **Apply database migration:**
   ```bash
   # Run in Supabase SQL Editor
   # src/database/migrations/002_add_genres.sql
   ```

2. **Bootstrap genres:**
   ```bash
   npm run genres:bootstrap
   ```

3. **Backfill existing events:**
   ```bash
   npm run genres:backfill
   ```

### Query Examples

**Get events with their genres:**
```sql
SELECT e.name, g.name as genre, eg.classification_primary
FROM prtnr_events e
JOIN prtnr_event_genres eg ON e.id = eg.event_id
JOIN prtnr_genres g ON eg.genre_id = g.id
WHERE e.source = 'ticketmaster'
ORDER BY e.date DESC;
```

**Filter events by genre:**
```sql
SELECT e.*
FROM prtnr_events e
JOIN prtnr_event_genres eg ON e.id = eg.event_id
JOIN prtnr_genres g ON eg.genre_id = g.id
WHERE g.normalized_name = 'dance-electronic';
```

### Documentation

- **Full Implementation Plan**: [`GENRE_IMPLEMENTATION_PLAN.md`](GENRE_IMPLEMENTATION_PLAN.md) (1300+ lines)
- **Quick Reference**: [`GENRE_QUICK_REFERENCE.md`](GENRE_QUICK_REFERENCE.md) (200+ lines)

### Related

- Issue: #13
- PR: #8 (Normalized Schema)
- Ticketmaster Discovery API: [Documentation](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)

---

**Add this section to README.md under "Features" after implementing the genre feature.**
