# Migration vs Fresh Setup Comparison

This document compares the two approaches for schema normalization.

## Approach 1: Migration (Original Implementation)

### Tables
- Modified `partner_events` to add `venue_id` column
- Created `partner_venues`, `partner_artists`, `partner_event_artists`
- Kept legacy JSONB columns for backward compatibility

### Process
1. Run migration SQL to add new tables and columns
2. Run backfill script to migrate existing JSONB data
3. Validate migration success
4. Eventually remove legacy JSONB columns

### Pros
- Preserves existing `partner_events` table name
- Migrates all existing data
- Backward compatible during transition

### Cons
- Complex migration process
- Risk of data inconsistency during backfill
- Requires careful validation
- Can't easily rollback without backup

## Approach 2: Fresh Setup (Current Implementation)

### Tables
- Brand new `venues`, `artists`, `events_v2`, `event_artists`
- Existing `partner_events` completely untouched
- Both schemas can coexist

### Process
1. Run `schema_new.sql` to create new tables
2. Start the application
3. New data automatically goes into new tables

### Pros
- ✅ Zero migration complexity
- ✅ No risk to existing data
- ✅ Clean start with proper normalization
- ✅ Both systems can run in parallel
- ✅ Easy to setup and test
- ✅ Can rollback instantly (just use old tables)

### Cons
- Doesn't migrate existing `partner_events` data
- Need to keep old table if historical data is important

## When to Use Each Approach

### Use Fresh Setup (Approach 2) if:
- You're starting fresh or don't need historical data
- You want to avoid migration complexity
- You want to test new schema alongside old one
- You prefer clean architecture over data migration
- You can afford to start with empty tables

**Current Implementation**: Fresh Setup ✅

### Use Migration (Approach 1) if:
- You must preserve all historical event data
- You need seamless transition with no data loss
- You can't afford to start with empty tables
- You have clients depending on `partner_events` table name

## Implementation Files

### Fresh Setup (Current)
- `src/database/schema_new.sql` - Creates all new tables
- `FRESH_SETUP.md` - Setup guide
- No migration/backfill scripts needed

### Migration (Reference Only)
- `src/database/migrations/001_create_normalized_tables.sql`
- `src/database/migrations/999_rollback_normalized_schema.sql`
- `src/database/backfill.js`
- `src/database/migrate.js`
- `src/database/validate.js`
- `MIGRATION_GUIDE.md`

These files remain in the codebase as reference but are not required for the current fresh setup approach.

## Recommendation

The **Fresh Setup approach** is recommended because:
1. Significantly simpler to implement
2. Zero risk to existing data
3. Both schemas can coexist
4. Easier to test and validate
5. Clean architecture from day one

If you need historical data from `partner_events`, you can optionally run a one-time data copy later, but it's not required for the system to function.

## Current Status

✅ **Implementation uses Fresh Setup approach (Approach 2)**
- New table names: `venues`, `artists`, `events_v2`, `event_artists`
- No migration required
- Simple setup with one SQL file
- Existing `partner_events` untouched
