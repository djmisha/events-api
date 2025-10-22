# Quick Start - Schema Normalization

Fast reference guide for implementing the normalized schema.

## For New Installations

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# 3. Run migration SQL
# Open Supabase Dashboard > SQL Editor
# Copy and run: src/database/migrations/001_create_normalized_tables.sql

# 4. Start the server
npm run dev
```

The normalized schema is now active. New events will be stored with proper relationships.

## For Existing Installations (Migration)

```bash
# 1. Backup your database
# Supabase Dashboard > Database > Backups > Create Backup

# 2. Run migration SQL
# Open Supabase Dashboard > SQL Editor
# Copy and run: src/database/migrations/001_create_normalized_tables.sql

# 3. Run backfill to migrate existing data
npm run backfill

# 4. Validate migration
npm run validate

# 5. Test API
curl "http://localhost:8000/api/v1/events/71/chicago" \
  -H "x-api-key: YOUR_API_KEY"
```

## Available NPM Scripts

```bash
npm run dev        # Start development server
npm run migrate    # Show migration instructions
npm run backfill   # Migrate existing data to normalized schema
npm run validate   # Validate migration success
npm run cleanup    # Remove expired events
```

## Key Files

- `src/database/migrations/001_create_normalized_tables.sql` - Forward migration
- `src/database/migrations/999_rollback_normalized_schema.sql` - Rollback
- `src/database/backfill.js` - Data migration script
- `src/services/normalizedData.js` - Normalized data operations
- `MIGRATION_GUIDE.md` - Full migration guide
- `API_CHANGES.md` - API response changes

## API Response Format

### Before
```json
{
  "data": [{
    "id": 12345,
    "venue": {"name": "Venue"},
    "artistlist": [{"name": "Artist"}]
  }]
}
```

### After
```json
{
  "data": [{
    "id": 12345,
    "venue": {
      "id": "uuid",
      "name": "Venue",
      "city": "Chicago"
    },
    "artists": [{
      "id": "uuid",
      "name": "Artist"
    }]
  }]
}
```

## Troubleshooting

**Issue:** Backfill fails
```bash
# Check logs for errors
# Verify migration SQL was run
npm run validate
```

**Issue:** API returns null venue/artists
```bash
# Re-run backfill
npm run backfill
```

**Issue:** Need to rollback
```sql
-- In Supabase SQL Editor, run:
-- src/database/migrations/999_rollback_normalized_schema.sql
```

## Production Deployment

1. **Test in staging first**
2. **Create production backup**
3. **Run migration SQL**
4. **Run backfill**
5. **Validate with `npm run validate`**
6. **Monitor for 24 hours**

## Support

See detailed guides:
- `MIGRATION_GUIDE.md` - Full migration steps
- `API_CHANGES.md` - API documentation
- `IMPLEMENTATION_SUMMARY.md` - Technical details
