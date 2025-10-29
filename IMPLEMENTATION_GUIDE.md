# Genre Implementation Guide

**Date**: October 29, 2025  
**Status**: Ready for Implementation  
**Related Issue**: #13

---

## Quick Implementation Steps

This guide provides **specific, actionable steps** to implement the genre feature from development to production.

---

## Phase 1: Database Setup (15 minutes)

### Step 1.1: Apply Database Migration

**In Supabase SQL Editor**, run the following SQL file:

```bash
# Location: src/database/migrations/002_add_genres.sql
```

**Or copy-paste this SQL:**

```sql
-- Run this entire block in Supabase SQL Editor
BEGIN;

CREATE TABLE IF NOT EXISTS prtnr_genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  normalized_name TEXT,
  ticketmaster_genre_id TEXT,
  ticketmaster_segment_id TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prtnr_genres_tm_id 
  ON prtnr_genres(ticketmaster_genre_id) 
  WHERE ticketmaster_genre_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prtnr_genres_normalized_name 
  ON prtnr_genres(normalized_name);

CREATE INDEX IF NOT EXISTS idx_prtnr_genres_name 
  ON prtnr_genres(name);

CREATE TABLE IF NOT EXISTS prtnr_genre_subgenres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  genre_id UUID NOT NULL REFERENCES prtnr_genres(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT,
  ticketmaster_subgenre_id TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prtnr_subgenres_tm_id 
  ON prtnr_genre_subgenres(ticketmaster_subgenre_id) 
  WHERE ticketmaster_subgenre_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prtnr_subgenres_genre_id 
  ON prtnr_genre_subgenres(genre_id);

CREATE INDEX IF NOT EXISTS idx_prtnr_subgenres_name 
  ON prtnr_genre_subgenres(name);

CREATE TABLE IF NOT EXISTS prtnr_event_genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES prtnr_events(id) ON DELETE CASCADE,
  genre_id UUID NOT NULL REFERENCES prtnr_genres(id) ON DELETE CASCADE,
  classification_primary BOOLEAN DEFAULT false,
  ticketmaster_classification_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (event_id, genre_id)
);

CREATE INDEX IF NOT EXISTS idx_prtnr_event_genres_event_id 
  ON prtnr_event_genres(event_id);

CREATE INDEX IF NOT EXISTS idx_prtnr_event_genres_genre_id 
  ON prtnr_event_genres(genre_id);

CREATE INDEX IF NOT EXISTS idx_prtnr_event_genres_primary 
  ON prtnr_event_genres(event_id, classification_primary);

CREATE OR REPLACE FUNCTION update_prtnr_genres_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prtnr_genres_updated_at
  BEFORE UPDATE ON prtnr_genres
  FOR EACH ROW
  EXECUTE FUNCTION update_prtnr_genres_updated_at();

COMMIT;
```

### Step 1.2: Verify Migration

Run these verification queries in Supabase SQL Editor:

```sql
-- Should return 3 tables
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND tablename LIKE 'prtnr_%genre%'
ORDER BY tablename;

-- Should show table structure
\d prtnr_genres
\d prtnr_genre_subgenres
\d prtnr_event_genres

-- Should return 0 (empty tables)
SELECT COUNT(*) FROM prtnr_genres;
SELECT COUNT(*) FROM prtnr_genre_subgenres;
SELECT COUNT(*) FROM prtnr_event_genres;
```

**Expected output:**
- 3 tables: `prtnr_genres`, `prtnr_genre_subgenres`, `prtnr_event_genres`
- All counts should be 0 (empty tables)

---

## Phase 2: Build and Deploy Code (10 minutes)

### Step 2.1: Build the Project

```bash
npm run build
```

**Expected output:**
- No TypeScript errors
- Files compiled to `dist/` directory

### Step 2.2: Test Build Locally

```bash
# Start the development server
npm run dev

# In another terminal, test the new endpoints
curl -H "x-api-key: YOUR_API_KEY" http://localhost:8000/api/genres
```

**Expected response:**
```json
{
  "genres": [],
  "count": 0
}
```

### Step 2.3: Deploy to Production

```bash
# For Vercel deployment
vercel --prod

# Or commit and push (triggers auto-deploy)
git add .
git commit -m "Implement genre classification feature"
git push origin main
```

---

## Phase 3: Bootstrap Genres (5 minutes)

### Step 3.1: Run Bootstrap Job

**Set environment variables:**
```bash
export TICKETMASTER_API_KEY=your_api_key_here
export SUPABASE_URL=your_supabase_url
export SUPABASE_SERVICE_KEY=your_service_key
```

**Run the bootstrap:**
```bash
npm run genres:bootstrap
```

**Expected output:**
```
[INFO] Starting genre bootstrap from Ticketmaster
[INFO] Fetched 42 music genres from Ticketmaster
[INFO] Genre bootstrap complete: 42 created, 0 updated
```

### Step 3.2: Verify Genres Were Created

In Supabase SQL Editor:

```sql
-- Should return 40-100 genres
SELECT COUNT(*) FROM prtnr_genres;

-- View first 10 genres
SELECT id, name, normalized_name, ticketmaster_genre_id 
FROM prtnr_genres 
ORDER BY name 
LIMIT 10;
```

**Expected output:**
- Count: 40-100 genres
- Sample genres: Dance/Electronic, Rock, Pop, Hip-Hop, etc.

---

## Phase 4: Backfill Existing Events (Optional - 10 minutes)

**Note:** Only run this if you have existing Ticketmaster events in your database with classification data.

### Step 4.1: Run Backfill Job

```bash
npm run genres:backfill
```

**Expected output:**
```
[INFO] Starting event-genre backfill
[INFO] Processing 1234 Ticketmaster events
[INFO] Backfill complete: 987 events mapped, 247 skipped
```

### Step 4.2: Verify Event-Genre Mappings

In Supabase SQL Editor:

```sql
-- Count event-genre mappings
SELECT COUNT(*) FROM prtnr_event_genres;

-- View sample mappings
SELECT 
  e.name as event_name,
  g.name as genre_name,
  eg.classification_primary
FROM prtnr_event_genres eg
JOIN prtnr_events e ON eg.event_id = e.id
JOIN prtnr_genres g ON eg.genre_id = g.id
LIMIT 10;

-- Genre coverage percentage
SELECT 
  COUNT(DISTINCT CASE WHEN eg.event_id IS NOT NULL THEN e.id END) * 100.0 / COUNT(e.id) as coverage_pct
FROM prtnr_events e
LEFT JOIN prtnr_event_genres eg ON e.id = eg.event_id
WHERE e.source = 'ticketmaster';
```

**Expected output:**
- Mappings created for events with classification data
- Coverage percentage: 80-95%

---

## Phase 5: Test API Endpoints (5 minutes)

### Test 1: List All Genres

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  https://your-app.vercel.app/api/genres
```

**Expected response:**
```json
{
  "genres": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Dance/Electronic",
      "normalized_name": "dance-electronic",
      "ticketmaster_genre_id": "KnvZfZ7vAvF",
      "created_at": "2025-10-29T10:00:00.000Z"
    }
  ],
  "count": 42
}
```

### Test 2: Get Events for Genre

```bash
# Get a genre ID from the previous response
GENRE_ID="550e8400-e29b-41d4-a716-446655440000"

curl -H "x-api-key: YOUR_API_KEY" \
  "https://your-app.vercel.app/api/genres/${GENRE_ID}/events"
```

**Expected response:**
```json
{
  "genre_id": "550e8400-e29b-41d4-a716-446655440000",
  "events": [
    {
      "id": 12345,
      "name": "Electronic Music Festival",
      "date": "2025-11-15"
    }
  ],
  "count": 156
}
```

### Test 3: Genre Statistics

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  https://your-app.vercel.app/api/genres/stats
```

**Expected response:**
```json
{
  "total_genres": 42,
  "total_mappings": 987,
  "events_with_genres": 987,
  "events_without_genres": 247
}
```

---

## Phase 6: Monitor and Validate (Ongoing)

### Daily Monitoring Queries

Run these in Supabase SQL Editor:

```sql
-- 1. Genre coverage percentage (target: >90%)
SELECT 
  COUNT(DISTINCT CASE WHEN eg.event_id IS NOT NULL THEN e.id END) * 100.0 / COUNT(e.id) as coverage_pct
FROM prtnr_events e
LEFT JOIN prtnr_event_genres eg ON e.id = eg.event_id
WHERE e.source = 'ticketmaster';

-- 2. Events without genres (investigate if >10%)
SELECT COUNT(*) as unmapped_count
FROM prtnr_events e
LEFT JOIN prtnr_event_genres eg ON e.id = eg.event_id
WHERE e.source = 'ticketmaster' AND eg.event_id IS NULL;

-- 3. Top 10 genres by event count
SELECT 
  g.name,
  COUNT(eg.event_id) as event_count
FROM prtnr_genres g
LEFT JOIN prtnr_event_genres eg ON g.id = eg.genre_id
GROUP BY g.id, g.name
ORDER BY event_count DESC
LIMIT 10;

-- 4. Recent genre assignments (last 24 hours)
SELECT 
  e.name as event,
  g.name as genre,
  eg.created_at
FROM prtnr_event_genres eg
JOIN prtnr_events e ON eg.event_id = e.id
JOIN prtnr_genres g ON eg.genre_id = g.id
WHERE eg.created_at > NOW() - INTERVAL '24 hours'
ORDER BY eg.created_at DESC
LIMIT 20;
```

---

## Rollback Procedure (If Needed)

### To Rollback Database Changes

**In Supabase SQL Editor**, run:

```sql
-- Location: src/database/rollbacks/002_rollback_genres.sql

BEGIN;
DROP TABLE IF EXISTS prtnr_event_genres CASCADE;
DROP TABLE IF EXISTS prtnr_genre_subgenres CASCADE;
DROP TABLE IF EXISTS prtnr_genres CASCADE;
DROP FUNCTION IF EXISTS update_prtnr_genres_updated_at CASCADE;
COMMIT;
```

**Verify rollback:**
```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND tablename LIKE 'prtnr_%genre%';
-- Should return 0 rows
```

### To Rollback Code Changes

```bash
# Revert to previous commit
git revert HEAD

# Or reset to before genre implementation
git reset --hard <commit_before_genre_implementation>

# Deploy
vercel --prod
```

---

## Troubleshooting

### Issue: Bootstrap fails with "Ticketmaster API key not configured"

**Solution:**
```bash
# Check environment variable
echo $TICKETMASTER_API_KEY

# Set if missing
export TICKETMASTER_API_KEY=your_key_here

# For Vercel, set in dashboard:
# Settings → Environment Variables → Add TICKETMASTER_API_KEY
```

### Issue: Migration fails with "relation prtnr_events does not exist"

**Solution:**
This means PR #8 (normalized schema) hasn't been merged yet. The genre tables depend on `prtnr_events`. 

Options:
1. Wait for PR #8 to merge
2. Use `partner_events` instead (modify migration to reference `partner_events` instead of `prtnr_events`)

### Issue: Genres appear but events don't have genres

**Solution:**
```bash
# Re-run bootstrap to ensure all genres exist
npm run genres:bootstrap

# Then re-run backfill
npm run genres:backfill

# Check logs for errors
tail -f logs/app.log
```

### Issue: Duplicate genre error

**Solution:**
```sql
-- Find duplicates
SELECT ticketmaster_genre_id, COUNT(*) 
FROM prtnr_genres 
GROUP BY ticketmaster_genre_id 
HAVING COUNT(*) > 1;

-- Remove duplicates (keep first one)
DELETE FROM prtnr_genres
WHERE id NOT IN (
  SELECT MIN(id)
  FROM prtnr_genres
  GROUP BY ticketmaster_genre_id
);
```

---

## Production Checklist

Before going to production, verify:

- [ ] Database migration applied successfully
- [ ] All 3 tables created (prtnr_genres, prtnr_genre_subgenres, prtnr_event_genres)
- [ ] Genres bootstrap completed (40-100 genres)
- [ ] Event backfill completed (if applicable)
- [ ] API endpoints respond correctly
- [ ] Genre coverage >80%
- [ ] No errors in application logs
- [ ] Environment variables set in production
- [ ] Monitoring queries bookmarked
- [ ] Rollback procedure tested in staging

---

## Next Steps After Production

1. **Monitor metrics** using the daily monitoring queries
2. **Re-run bootstrap** weekly to catch new genres from Ticketmaster
3. **Add genre filters** to event search endpoints
4. **Build analytics** dashboards showing genre distribution
5. **Consider adding** genre-based recommendations

---

## Support

For issues or questions:
- Check logs: `tail -f logs/app.log`
- Review documentation: `GENRE_IMPLEMENTATION_PLAN.md`
- Check Supabase logs in dashboard
- Verify environment variables are set

---

**Implementation Time Estimate:**
- Phase 1 (Database): 15 minutes
- Phase 2 (Deploy): 10 minutes
- Phase 3 (Bootstrap): 5 minutes
- Phase 4 (Backfill): 10 minutes
- Phase 5 (Testing): 5 minutes
- **Total: ~45 minutes**

**Status:** ✅ Ready for immediate implementation

---

## EDM Train Automatic Genre Assignment

### Overview

All EDM Train events are **automatically assigned genres** when they are fetched via the webhook. No manual migration or backfill is required for EDM Train events.

### How It Works

1. **Automatic Assignment**: When the webhook fetches EDM Train data, genres are automatically assigned during the data processing
2. **Dance/Electronic Genre**: Most EDM Train events receive the "Dance/Electronic" genre
3. **Edge Case Handling**: Events flagged as non-electronic (rare) receive "Pop" genre

### Genre Assignment Rules

**For Electronic Music Events** (`electronicgenreind: true`):
- Genre: **Dance/Electronic**
- This applies to 95%+ of EDM Train events
- Assigned automatically in `fetchPartnerData` job

**For Non-Electronic Events** (`electronicgenreind: false` - edge case):
- Genre: **Pop**
- These are rare exceptions in the EDM Train catalog
- Logged for visibility

### Code Implementation

The genre assignment happens in `src/jobs/fetchPartnerData.ts`:

```typescript
// After inserting EDM Train events, genres are automatically assigned
const assignGenresToEdmTrainEvents = async (events) => {
  // Find Dance/Electronic and Pop genres
  const electronicGenre = await supabase
    .from("prtnr_genres")
    .select("id")
    .eq("normalized_name", "dance-electronic")
    .maybeSingle();

  const popGenre = await supabase
    .from("prtnr_genres")
    .select("id")
    .eq("normalized_name", "pop")
    .maybeSingle();

  // For each event, use the electronicgenreind flag from EDM Train API
  for (const event of events) {
    const genreId = event.electronicgenreind
      ? electronicGenre.id  // Electronic → Dance/Electronic
      : popGenre.id;        // Non-electronic → Pop

    await supabase.from("prtnr_event_genres").upsert({
      event_id: event.id,
      genre_id: genreId,
      classification_primary: true,
    });
  }
};
```

### No Migration Required

**Key Points:**
- ✅ No manual migration needed for EDM Train events
- ✅ No backfill job required
- ✅ Webhook automatically updates genres on next data fetch
- ✅ All future EDM Train events will have genres assigned

### Verification

After the next webhook run, verify genre assignment:

```sql
-- Check EDM Train events with genres
SELECT 
  e.name,
  g.name as genre,
  eg.classification_primary
FROM partner_events e
JOIN prtnr_event_genres eg ON e.id = eg.event_id
JOIN prtnr_genres g ON eg.genre_id = g.id
WHERE e.source = 'edmtrain'
LIMIT 10;

-- Count EDM Train events with genres
SELECT COUNT(*) as with_genres
FROM partner_events e
JOIN prtnr_event_genres eg ON e.id = eg.event_id
WHERE e.source = 'edmtrain';

-- Count EDM Train events without genres
SELECT COUNT(*) as without_genres
FROM partner_events e
LEFT JOIN prtnr_event_genres eg ON e.id = eg.event_id
WHERE e.source = 'edmtrain' AND eg.event_id IS NULL;
```

**Expected Results:**
- After webhook runs: 100% of EDM Train events should have genres
- Genre coverage should be complete within 24 hours

### Edge Case: Non-Electronic Events

**Assignment for `electronicgenreind: false` events:**

The implementation assigns these events to **"Pop"** genre.

**Rationale:**
- EDM Train occasionally lists non-electronic events (DJ events, concerts, etc.)
- "Pop" serves as a universal genre for diverse music styles
- These edge cases are rare (<5% of EDM Train events)

**Logging:**
Non-electronic events are logged for review:
```
[INFO] EDM Train event "John Doe Live" (ID: 12345) is flagged as non-electronic, assigning Pop genre
```

### Troubleshooting

**Issue**: EDM Train events have no genres after webhook run

**Solution**:
```bash
# 1. Verify genres table is populated
SELECT COUNT(*) FROM prtnr_genres WHERE normalized_name = 'dance-electronic';
# Should return 1

# 2. If genres not found, run bootstrap
npm run genres:bootstrap

# 3. Trigger webhook manually to reassign
curl -X POST -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  https://your-app.vercel.app/api/webhook/fetch-partner-data \
  -d '{"cityId": 71, "cityName": "chicago"}'
```

**Issue**: Some EDM Train events have wrong genre

**Solution**:
```sql
-- Check the electronicgenreind flag
SELECT id, name, electronicgenreind, othergenreind 
FROM partner_events 
WHERE source = 'edmtrain' AND id = YOUR_EVENT_ID;

-- If flag is incorrect, it comes from EDM Train API
-- Contact EDM Train support to correct the data
```

---

## Summary: EDM Train vs Ticketmaster Genres

| Aspect | EDM Train | Ticketmaster |
|--------|-----------|--------------|
| **Assignment Method** | Automatic via webhook | Manual backfill + classifications |
| **Primary Genre** | Dance/Electronic | Various (from API) |
| **Edge Cases** | Pop (rare, for non-electronic) | Multiple genres supported |
| **Migration Required** | ❌ No | ✅ Yes (backfill) |
| **Update Frequency** | Every webhook run | On backfill or new events |
| **Coverage** | 100% automatic | 80-95% (depends on API data) |

---

## Next Steps

After deploying this update:

1. ✅ Wait for next webhook run (or trigger manually)
2. ✅ Verify EDM Train events have genres using queries above
3. ✅ Monitor logs for non-electronic event assignments
4. ✅ Run Ticketmaster backfill if needed (separate process)

**No action required for EDM Train events - they will automatically get genres!**

