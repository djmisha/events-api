# Genre Implementation Plan for Events API

**Date**: October 29, 2025  
**Status**: Implementation Plan  
**Related Issue**: #13  
**Related PR**: #8 (Normalized Schema)

---

## Executive Summary

This document provides a comprehensive implementation plan for adding **music genre classification** to the Events API. The implementation:

- Integrates with the normalized schema from PR #8 (using `prtnr_` prefix)
- Uses Ticketmaster Discovery API for authoritative genre data
- Filters to **Music segment only** (excludes Comedy, Sports, Theatre, etc.)
- Implements a flexible many-to-many relationship between events and genres
- Uses internal UUIDs with external Ticketmaster IDs for future-proof flexibility

---

## Table of Contents

1. [Background & Research](#1-background--research)
2. [Key Decisions & Rationale](#2-key-decisions--rationale)
3. [Database Schema](#3-database-schema)
4. [TypeScript Type Definitions](#4-typescript-type-definitions)
5. [Ticketmaster API Integration](#5-ticketmaster-api-integration)
6. [ETL & Data Flow](#6-etl--data-flow)
7. [Service Layer Implementation](#7-service-layer-implementation)
8. [Migration & Rollback](#8-migration--rollback)
9. [Testing Strategy](#9-testing-strategy)
10. [Admin & Monitoring](#10-admin--monitoring)
11. [Implementation Checklist](#11-implementation-checklist)

---

## 1. Background & Research

### 1.1 Ticketmaster Classification Model

Ticketmaster uses a hierarchical classification system:

```
segment (Music, Sports, Arts & Theatre, etc.)
  └── genre (Rock, Pop, Hip-Hop, Electronic, etc.)
      └── subGenre (Alternative Rock, Indie Pop, House, etc.)
```

**Key characteristics:**
- Events contain a `classifications` array
- Each classification has: `segment`, `genre`, `subGenre`, `type`, `subType`
- A `primary` flag indicates the main classification
- Available via Discovery API `/discovery/v2/classifications` endpoint

### 1.2 Discovery API Endpoints

**Classifications Endpoint:**
```
GET https://app.ticketmaster.com/discovery/v2/classifications.json
  ?segmentName=Music
  &apikey=YOUR_KEY
```

**Event Data:**
Events already contain classification data in their response:
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

---

## 2. Key Decisions & Rationale

### 2.1 ID Strategy ✅ RECOMMENDED

**Decision:** Use internal UUID primary key + store Ticketmaster genre ID separately

**Implementation:**
```sql
CREATE TABLE prtnr_genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- Internal PK
  ticketmaster_genre_id TEXT UNIQUE,              -- External ID
  ...
);
```

**Rationale:**
- ✅ **Multi-source flexibility**: Can add genres from other sources in future
- ✅ **Local control**: Can merge, split, or rename genres without Ticketmaster coupling
- ✅ **Performance**: Native UUID lookups are fast
- ✅ **Safe updates**: Ticketmaster ID changes don't break relationships
- ❌ **Alternative rejected**: Using TM ID as PK couples DB to single provider

### 2.2 Genre Filtering Policy

**Decision:** Music segment only

**Filter criteria:**
```typescript
classifications.filter(c => c.segment?.name === "Music")
```

**Excluded segments:**
- Comedy
- Sports
- Arts & Theatre
- Film
- Family
- Other non-music categories

### 2.3 Schema Alignment

**Decision:** Use `prtnr_` prefix to match PR #8 normalized schema

**Table names:**
- `prtnr_genres` (not `genres`)
- `prtnr_genre_subgenres` (not `genre_subgenres`)
- `prtnr_event_genres` (not `event_genres`)

This ensures consistency with the normalized schema being introduced in PR #8.

### 2.4 Many-to-Many Relationships

**Decision:** Events can have multiple genres

**Rationale:**
- An event can have primary genre: "Dance/Electronic"
- And secondary genres: "House", "Techno"
- Join table (`prtnr_event_genres`) manages relationships
- Preserve `classification_primary` flag for main genre

---

## 3. Database Schema

### 3.1 Table: `prtnr_genres`

**Purpose:** Master list of music genres

```sql
-- Genres table (master list)
CREATE TABLE IF NOT EXISTS prtnr_genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  normalized_name TEXT,                    -- Lowercase slug for matching
  ticketmaster_genre_id TEXT UNIQUE,       -- TM genre ID (e.g., "KnvZfZ7vAvF")
  ticketmaster_segment_id TEXT,            -- Always "KZFzniwnSyZfZ7v7nJ" for Music
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,      -- Store original TM data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_prtnr_genres_tm_id 
  ON prtnr_genres(ticketmaster_genre_id) 
  WHERE ticketmaster_genre_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prtnr_genres_normalized_name 
  ON prtnr_genres(normalized_name);

CREATE INDEX IF NOT EXISTS idx_prtnr_genres_name 
  ON prtnr_genres(name);
```

**Key fields:**
- `id`: Internal UUID primary key
- `ticketmaster_genre_id`: External Ticketmaster genre ID (unique)
- `normalized_name`: Lowercase slug (e.g., "dance-electronic") for fuzzy matching
- `metadata`: Store original Ticketmaster classification object

### 3.2 Table: `prtnr_genre_subgenres`

**Purpose:** Optional hierarchy for subgenres

```sql
-- Subgenres table (optional hierarchy)
CREATE TABLE IF NOT EXISTS prtnr_genre_subgenres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  genre_id UUID NOT NULL REFERENCES prtnr_genres(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT,
  ticketmaster_subgenre_id TEXT UNIQUE,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_prtnr_subgenres_tm_id 
  ON prtnr_genre_subgenres(ticketmaster_subgenre_id) 
  WHERE ticketmaster_subgenre_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prtnr_subgenres_genre_id 
  ON prtnr_genre_subgenres(genre_id);

CREATE INDEX IF NOT EXISTS idx_prtnr_subgenres_name 
  ON prtnr_genre_subgenres(name);
```

**Note:** Subgenres are optional. Initial implementation can skip this table and only use `prtnr_genres`.

### 3.3 Table: `prtnr_event_genres`

**Purpose:** Many-to-many mapping between events and genres

```sql
-- Event → Genre mapping (many-to-many)
CREATE TABLE IF NOT EXISTS prtnr_event_genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT NOT NULL REFERENCES prtnr_events(id) ON DELETE CASCADE,
  genre_id UUID NOT NULL REFERENCES prtnr_genres(id) ON DELETE CASCADE,
  classification_primary BOOLEAN DEFAULT false,
  ticketmaster_classification_json JSONB,  -- Original classification object
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (event_id, genre_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prtnr_event_genres_event_id 
  ON prtnr_event_genres(event_id);

CREATE INDEX IF NOT EXISTS idx_prtnr_event_genres_genre_id 
  ON prtnr_event_genres(genre_id);

CREATE INDEX IF NOT EXISTS idx_prtnr_event_genres_primary 
  ON prtnr_event_genres(event_id, classification_primary);
```

**Key fields:**
- `event_id`: Foreign key to `prtnr_events.id`
- `genre_id`: Foreign key to `prtnr_genres.id`
- `classification_primary`: Indicates main genre for the event
- `ticketmaster_classification_json`: Store original classification for debugging

### 3.4 Timestamp Triggers

```sql
-- Auto-update timestamps for prtnr_genres
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
```

---

## 4. TypeScript Type Definitions

**File:** `src/types/index.ts`

```typescript
// Genre-related types

export interface Genre {
  id: string; // UUID
  name: string;
  normalized_name: string;
  ticketmaster_genre_id: string | null;
  ticketmaster_segment_id: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GenreSubgenre {
  id: string; // UUID
  genre_id: string; // UUID
  name: string;
  normalized_name: string;
  ticketmaster_subgenre_id: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EventGenre {
  id: string; // UUID
  event_id: number; // BIGINT
  genre_id: string; // UUID
  classification_primary: boolean;
  ticketmaster_classification_json: Record<string, unknown> | null;
  created_at: string;
}

// Ticketmaster API types
export interface TicketmasterClassification {
  primary?: boolean;
  segment?: {
    id: string;
    name: string;
  };
  genre?: {
    id: string;
    name: string;
  };
  subGenre?: {
    id: string;
    name: string;
  };
  type?: {
    id: string;
    name: string;
  };
  subType?: {
    id: string;
    name: string;
  };
}

// Extended event type with genres
export interface EventWithGenres extends PartnerEvent {
  genres?: Genre[];
  primary_genre?: Genre | null;
}
```

---

## 5. Ticketmaster API Integration

### 5.1 Discovery API Service

**File:** `src/services/ticketmasterGenres.ts`

```typescript
import axios from "axios";
import logger from "./logger";
import { TicketmasterClassification } from "../types";

interface TicketmasterGenreResponse {
  _embedded?: {
    genres?: Array<{
      id: string;
      name: string;
      segment?: {
        id: string;
        name: string;
      };
    }>;
  };
}

class TicketmasterGenresService {
  private apiKey: string | undefined;
  private baseURL: string;

  constructor() {
    this.apiKey = process.env.TICKETMASTER_API_KEY;
    this.baseURL = "https://app.ticketmaster.com/discovery/v2";

    if (!this.apiKey) {
      logger.warn("Ticketmaster API key not configured for genres service");
    }
  }

  /**
   * Fetch all music genres from Ticketmaster Discovery API
   */
  async fetchMusicGenres(): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error("Ticketmaster API key not configured");
    }

    try {
      const url = `${this.baseURL}/classifications.json`;
      const response = await axios.get<TicketmasterGenreResponse>(url, {
        params: {
          apikey: this.apiKey,
          segmentName: "Music",
        },
      });

      const genres = response.data._embedded?.genres || [];
      logger.info(`Fetched ${genres.length} music genres from Ticketmaster`);
      return genres;
    } catch (error) {
      logger.error("Failed to fetch Ticketmaster genres:", {
        message: error instanceof Error ? error.message : "Unknown error",
        status: axios.isAxiosError(error) ? error.response?.status : undefined,
      });
      throw error;
    }
  }

  /**
   * Extract music-only classifications from event
   */
  extractMusicClassifications(
    classifications: TicketmasterClassification[] = []
  ): TicketmasterClassification[] {
    return classifications.filter(
      (c) => c.segment?.name === "Music" || c.segment?.id === "KZFzniwnSyZfZ7v7nJ"
    );
  }
}

export default new TicketmasterGenresService();
```

### 5.2 Update Ticketmaster Event Service

**File:** `src/services/ticketmaster.ts` (modification)

Add classifications to the interface:

```typescript
interface TicketmasterEvent {
  id: string;
  name: string;
  dates: {
    start: {
      localDate: string;
      localTime?: string;
    };
  };
  _embedded?: {
    venues?: Array<{...}>;
    attractions?: Array<{...}>;
  };
  url?: string;
  classifications?: Array<{
    primary?: boolean;
    segment?: { id: string; name: string };
    genre?: { id: string; name: string };
    subGenre?: { id: string; name: string };
  }>;
}
```

---

## 6. ETL & Data Flow

### 6.1 Bootstrap Process (One-time)

**Step 1:** Fetch all music genres from Ticketmaster

```typescript
// File: src/jobs/bootstrapGenres.ts
import ticketmasterGenresService from "../services/ticketmasterGenres";
import genreService from "../services/genres";
import logger from "../services/logger";

export const execute = async (): Promise<void> => {
  logger.info("Starting genre bootstrap from Ticketmaster");

  try {
    // Fetch all music genres
    const genres = await ticketmasterGenresService.fetchMusicGenres();

    // Upsert each genre
    let created = 0;
    let updated = 0;

    for (const genre of genres) {
      const result = await genreService.upsertGenre({
        name: genre.name,
        ticketmaster_genre_id: genre.id,
        ticketmaster_segment_id: genre.segment?.id || null,
      });

      if (result.created) {
        created++;
      } else {
        updated++;
      }
    }

    logger.info(`Genre bootstrap complete: ${created} created, ${updated} updated`);
  } catch (error) {
    logger.error("Genre bootstrap failed:", error);
    throw error;
  }
};
```

**Step 2:** Map existing events to genres

```typescript
// File: src/jobs/backfillEventGenres.ts
import supabase from "../services/supabaseClient";
import genreService from "../services/genres";
import logger from "../services/logger";

export const execute = async (): Promise<void> => {
  logger.info("Starting event-genre backfill");

  // Fetch all Ticketmaster events from prtnr_events
  const { data: events, error } = await supabase
    .from("prtnr_events")
    .select("id, source, metadata")
    .eq("source", "ticketmaster");

  if (error) {
    logger.error("Failed to fetch events for backfill:", error);
    throw error;
  }

  logger.info(`Processing ${events?.length || 0} Ticketmaster events`);

  let mapped = 0;
  let skipped = 0;

  for (const event of events || []) {
    try {
      const classifications = event.metadata?.classifications || [];
      const musicClassifications = classifications.filter(
        (c: any) => c.segment?.name === "Music"
      );

      if (musicClassifications.length === 0) {
        skipped++;
        continue;
      }

      await genreService.mapEventGenres(event.id, musicClassifications);
      mapped++;
    } catch (error) {
      logger.error(`Failed to map genres for event ${event.id}:`, error);
    }
  }

  logger.info(`Backfill complete: ${mapped} events mapped, ${skipped} skipped`);
};
```

### 6.2 Incremental Process (Ongoing)

**Update:** `src/jobs/fetchPartnerData.ts`

```typescript
// After upserting event in prtnr_events, map genres
if (source === "ticketmaster" && event.classifications) {
  const musicClassifications = ticketmasterGenresService
    .extractMusicClassifications(event.classifications);
  
  if (musicClassifications.length > 0) {
    await genreService.mapEventGenres(eventId, musicClassifications);
  }
}
```

---

## 7. Service Layer Implementation

### 7.1 Genre Service

**File:** `src/services/genres.ts`

```typescript
import supabase from "./supabaseClient";
import logger from "./logger";
import { Genre, TicketmasterClassification } from "../types";

/**
 * Normalize genre name to slug format
 */
const normalizeGenreName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

class GenreService {
  /**
   * Upsert a genre by Ticketmaster genre ID
   */
  async upsertGenre(data: {
    name: string;
    ticketmaster_genre_id: string;
    ticketmaster_segment_id: string | null;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ genre: Genre; created: boolean }> {
    const normalized_name = normalizeGenreName(data.name);

    // Try to find existing genre by TM ID
    const { data: existing, error: selectError } = await supabase
      .from("prtnr_genres")
      .select("*")
      .eq("ticketmaster_genre_id", data.ticketmaster_genre_id)
      .single();

    if (selectError && selectError.code !== "PGRST116") {
      logger.error("Failed to check existing genre:", selectError);
      throw selectError;
    }

    if (existing) {
      // Update existing genre
      const { data: updated, error: updateError } = await supabase
        .from("prtnr_genres")
        .update({
          name: data.name,
          normalized_name,
          ticketmaster_segment_id: data.ticketmaster_segment_id,
          description: data.description,
          metadata: data.metadata,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError) {
        logger.error("Failed to update genre:", updateError);
        throw updateError;
      }

      return { genre: updated as Genre, created: false };
    }

    // Insert new genre
    const { data: inserted, error: insertError } = await supabase
      .from("prtnr_genres")
      .insert({
        name: data.name,
        normalized_name,
        ticketmaster_genre_id: data.ticketmaster_genre_id,
        ticketmaster_segment_id: data.ticketmaster_segment_id,
        description: data.description,
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to insert genre:", insertError);
      throw insertError;
    }

    return { genre: inserted as Genre, created: true };
  }

  /**
   * Map event to genres based on classifications
   */
  async mapEventGenres(
    eventId: number,
    classifications: TicketmasterClassification[]
  ): Promise<void> {
    for (const classification of classifications) {
      if (!classification.genre?.id) {
        continue;
      }

      // Find genre by TM ID
      const { data: genre, error: genreError } = await supabase
        .from("prtnr_genres")
        .select("id")
        .eq("ticketmaster_genre_id", classification.genre.id)
        .single();

      if (genreError) {
        logger.warn(`Genre not found for TM ID ${classification.genre.id}`);
        continue;
      }

      // Upsert event-genre mapping
      const { error: mappingError } = await supabase
        .from("prtnr_event_genres")
        .upsert(
          {
            event_id: eventId,
            genre_id: genre.id,
            classification_primary: classification.primary || false,
            ticketmaster_classification_json: classification,
          },
          {
            onConflict: "event_id,genre_id",
          }
        );

      if (mappingError) {
        logger.error("Failed to map event to genre:", mappingError);
        throw mappingError;
      }
    }
  }

  /**
   * Get genres for an event
   */
  async getEventGenres(eventId: number): Promise<Genre[]> {
    const { data, error } = await supabase
      .from("prtnr_event_genres")
      .select("genre_id, prtnr_genres(*)")
      .eq("event_id", eventId)
      .order("classification_primary", { ascending: false });

    if (error) {
      logger.error("Failed to fetch event genres:", error);
      throw error;
    }

    return (data || []).map((row) => row.prtnr_genres as Genre);
  }
}

export default new GenreService();
```

---

## 8. Migration & Rollback

### 8.1 Migration Script

**File:** `src/database/migrations/002_add_genres.sql`

```sql
-- Migration: Add genre tables
-- Date: 2025-10-29
-- Description: Creates prtnr_genres, prtnr_genre_subgenres, and prtnr_event_genres tables

BEGIN;

-- 1. Create prtnr_genres table
CREATE TABLE IF NOT EXISTS prtnr_genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  normalized_name TEXT,
  ticketmaster_genre_id TEXT UNIQUE,
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

-- 2. Create prtnr_genre_subgenres table (optional)
CREATE TABLE IF NOT EXISTS prtnr_genre_subgenres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  genre_id UUID NOT NULL REFERENCES prtnr_genres(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT,
  ticketmaster_subgenre_id TEXT UNIQUE,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prtnr_subgenres_tm_id 
  ON prtnr_genre_subgenres(ticketmaster_subgenre_id) 
  WHERE ticketmaster_subgenre_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prtnr_subgenres_genre_id 
  ON prtnr_genre_subgenres(genre_id);

-- 3. Create prtnr_event_genres join table
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

-- 4. Auto-update trigger for prtnr_genres
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

### 8.2 Rollback Script

**File:** `src/database/rollbacks/002_rollback_genres.sql`

```sql
-- Rollback: Remove genre tables
-- Date: 2025-10-29
-- Description: Drops prtnr_genres, prtnr_genre_subgenres, and prtnr_event_genres tables

BEGIN;

-- Drop tables in reverse order (respecting foreign keys)
DROP TABLE IF EXISTS prtnr_event_genres CASCADE;
DROP TABLE IF EXISTS prtnr_genre_subgenres CASCADE;
DROP TABLE IF EXISTS prtnr_genres CASCADE;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_prtnr_genres_updated_at CASCADE;

COMMIT;
```

### 8.3 Migration Execution

```bash
# Apply migration
npm run db:migrate:up 002_add_genres

# Or manually in Supabase SQL Editor:
# Copy contents of src/database/migrations/002_add_genres.sql and execute

# Bootstrap genres
npm run genres:bootstrap

# Backfill existing events
npm run genres:backfill
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Test genre normalization:**
```typescript
// src/services/genres.test.ts
describe("normalizeGenreName", () => {
  it("should lowercase and slug-ify genre names", () => {
    expect(normalizeGenreName("Dance/Electronic")).toBe("dance-electronic");
    expect(normalizeGenreName("Hip-Hop/Rap")).toBe("hip-hop-rap");
    expect(normalizeGenreName("R&B")).toBe("r-b");
  });
});
```

**Test music classification filtering:**
```typescript
// src/services/ticketmasterGenres.test.ts
describe("extractMusicClassifications", () => {
  it("should filter only Music segment classifications", () => {
    const classifications = [
      { segment: { name: "Music" }, genre: { id: "123", name: "Rock" } },
      { segment: { name: "Comedy" }, genre: { id: "456", name: "Stand-up" } },
    ];
    
    const result = ticketmasterGenresService.extractMusicClassifications(classifications);
    expect(result).toHaveLength(1);
    expect(result[0].genre?.name).toBe("Rock");
  });
});
```

### 9.2 Integration Tests

**Test genre upsert:**
```typescript
describe("GenreService.upsertGenre", () => {
  it("should create new genre on first call", async () => {
    const result = await genreService.upsertGenre({
      name: "Electronic",
      ticketmaster_genre_id: "KnvZfZ7vAvF",
      ticketmaster_segment_id: "KZFzniwnSyZfZ7v7nJ",
    });
    
    expect(result.created).toBe(true);
    expect(result.genre.name).toBe("Electronic");
  });
  
  it("should update existing genre on second call", async () => {
    const result = await genreService.upsertGenre({
      name: "Dance/Electronic",
      ticketmaster_genre_id: "KnvZfZ7vAvF",
      ticketmaster_segment_id: "KZFzniwnSyZfZ7v7nJ",
    });
    
    expect(result.created).toBe(false);
    expect(result.genre.name).toBe("Dance/Electronic");
  });
});
```

**Test event-genre mapping:**
```typescript
describe("GenreService.mapEventGenres", () => {
  it("should create event-genre mappings", async () => {
    const eventId = 12345;
    const classifications = [
      {
        primary: true,
        segment: { name: "Music" },
        genre: { id: "KnvZfZ7vAvF", name: "Electronic" },
      },
    ];
    
    await genreService.mapEventGenres(eventId, classifications);
    
    const genres = await genreService.getEventGenres(eventId);
    expect(genres).toHaveLength(1);
    expect(genres[0].name).toBe("Electronic");
  });
});
```

### 9.3 Manual Testing

**Bootstrap genres:**
```bash
npm run genres:bootstrap
# Verify: SELECT COUNT(*) FROM prtnr_genres;
# Expected: 50-100 genres
```

**Test event ingestion:**
```bash
# Trigger event fetch for a city
curl -X POST http://localhost:8000/api/webhook/fetch-partner-data \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"cityId": 71, "cityName": "chicago"}'

# Verify genres were mapped
SELECT e.id, e.name, g.name as genre_name
FROM prtnr_events e
JOIN prtnr_event_genres eg ON e.id = eg.event_id
JOIN prtnr_genres g ON eg.genre_id = g.id
WHERE e.source = 'ticketmaster'
LIMIT 10;
```

---

## 10. Admin & Monitoring

### 10.1 Admin Endpoints

**File:** `src/api/genres.ts`

```typescript
import express, { Request, Response } from "express";
import genreService from "../services/genres";
import logger from "../services/logger";

const router = express.Router();

/**
 * GET /api/genres
 * List all genres
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("prtnr_genres")
      .select("*")
      .order("name");

    if (error) throw error;

    res.json({
      genres: data,
      count: data?.length || 0,
    });
  } catch (error) {
    logger.error("Failed to fetch genres:", error);
    res.status(500).json({ error: "Failed to fetch genres" });
  }
});

/**
 * GET /api/genres/:id/events
 * Get events for a genre
 */
router.get("/:id/events", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("prtnr_event_genres")
      .select("event_id, prtnr_events(*)")
      .eq("genre_id", id);

    if (error) throw error;

    res.json({
      genre_id: id,
      events: data?.map((row) => row.prtnr_events) || [],
      count: data?.length || 0,
    });
  } catch (error) {
    logger.error("Failed to fetch genre events:", error);
    res.status(500).json({ error: "Failed to fetch genre events" });
  }
});

/**
 * GET /api/genres/stats
 * Genre statistics
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const stats = {
      total_genres: 0,
      total_mappings: 0,
      events_with_genres: 0,
      events_without_genres: 0,
    };

    // Count genres
    const { count: genreCount } = await supabase
      .from("prtnr_genres")
      .select("*", { count: "exact", head: true });
    stats.total_genres = genreCount || 0;

    // Count mappings
    const { count: mappingCount } = await supabase
      .from("prtnr_event_genres")
      .select("*", { count: "exact", head: true });
    stats.total_mappings = mappingCount || 0;

    // Count events with genres
    const { count: withGenres } = await supabase
      .from("prtnr_events")
      .select("id, prtnr_event_genres!inner(id)", {
        count: "exact",
        head: true,
      });
    stats.events_with_genres = withGenres || 0;

    res.json(stats);
  } catch (error) {
    logger.error("Failed to fetch genre stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
```

### 10.2 Monitoring Metrics

**Track these metrics:**

1. **Genre coverage**: % of events with at least one genre
   ```sql
   SELECT 
     COUNT(DISTINCT CASE WHEN eg.event_id IS NOT NULL THEN e.id END) * 100.0 / COUNT(e.id) as coverage_pct
   FROM prtnr_events e
   LEFT JOIN prtnr_event_genres eg ON e.id = eg.event_id
   WHERE e.source = 'ticketmaster';
   ```

2. **Unmapped classifications**: Events with no genre mappings
   ```sql
   SELECT COUNT(*) as unmapped_events
   FROM prtnr_events e
   LEFT JOIN prtnr_event_genres eg ON e.id = eg.event_id
   WHERE e.source = 'ticketmaster'
     AND eg.event_id IS NULL;
   ```

3. **Genre distribution**: Top genres by event count
   ```sql
   SELECT g.name, COUNT(eg.event_id) as event_count
   FROM prtnr_genres g
   JOIN prtnr_event_genres eg ON g.id = eg.genre_id
   GROUP BY g.id, g.name
   ORDER BY event_count DESC
   LIMIT 10;
   ```

### 10.3 Logging

Add structured logging to genre operations:

```typescript
logger.info("Genre upserted", {
  genre_id: result.genre.id,
  genre_name: result.genre.name,
  ticketmaster_id: result.genre.ticketmaster_genre_id,
  created: result.created,
});

logger.info("Event genres mapped", {
  event_id: eventId,
  genre_count: classifications.length,
  primary_genre: primaryClassification?.genre?.name,
});
```

---

## 11. Implementation Checklist

### Phase 1: Database Schema ✅

- [ ] Create migration file `002_add_genres.sql`
- [ ] Create rollback file `002_rollback_genres.sql`
- [ ] Test migration on staging database
- [ ] Verify indexes and foreign keys
- [ ] Test rollback script

### Phase 2: TypeScript Types & Services ✅

- [ ] Add genre types to `src/types/index.ts`
- [ ] Create `src/services/ticketmasterGenres.ts`
- [ ] Create `src/services/genres.ts`
- [ ] Add genre normalization utility function
- [ ] Update `src/services/ticketmaster.ts` to include classifications

### Phase 3: Bootstrap & ETL ✅

- [ ] Create `src/jobs/bootstrapGenres.ts`
- [ ] Create `src/jobs/backfillEventGenres.ts`
- [ ] Add npm scripts for bootstrap and backfill
- [ ] Test bootstrap on staging
- [ ] Test backfill on staging data
- [ ] Update `src/jobs/fetchPartnerData.ts` for incremental updates

### Phase 4: API Endpoints ✅

- [ ] Create `src/api/genres.ts`
- [ ] Add `GET /api/genres` endpoint
- [ ] Add `GET /api/genres/:id/events` endpoint
- [ ] Add `GET /api/genres/stats` endpoint
- [ ] Update `src/server.ts` to mount genre routes
- [ ] Add API documentation

### Phase 5: Testing ✅

- [ ] Write unit tests for genre normalization
- [ ] Write unit tests for classification filtering
- [ ] Write integration tests for genre upsert
- [ ] Write integration tests for event mapping
- [ ] Test end-to-end genre flow
- [ ] Validate music-only filtering

### Phase 6: Documentation ✅

- [ ] Update README.md with genre features
- [ ] Document API endpoints
- [ ] Add database schema diagram
- [ ] Document npm scripts
- [ ] Add troubleshooting guide

### Phase 7: Deployment ✅

- [ ] Run migration on production database
- [ ] Bootstrap genres from Ticketmaster
- [ ] Backfill existing events
- [ ] Monitor for errors and unmapped events
- [ ] Validate genre coverage metrics
- [ ] Update deployment docs

---

## Appendix A: Example Queries

### Get events with their genres

```sql
SELECT 
  e.id,
  e.name,
  e.date,
  g.name as genre,
  eg.classification_primary
FROM prtnr_events e
JOIN prtnr_event_genres eg ON e.id = eg.event_id
JOIN prtnr_genres g ON eg.genre_id = g.id
WHERE e.source = 'ticketmaster'
ORDER BY e.date DESC
LIMIT 50;
```

### Get primary genre for each event

```sql
SELECT 
  e.id,
  e.name,
  g.name as primary_genre
FROM prtnr_events e
LEFT JOIN prtnr_event_genres eg ON e.id = eg.event_id AND eg.classification_primary = true
LEFT JOIN prtnr_genres g ON eg.genre_id = g.id
WHERE e.source = 'ticketmaster'
LIMIT 50;
```

### Find events without genres

```sql
SELECT e.id, e.name, e.source, e.date
FROM prtnr_events e
LEFT JOIN prtnr_event_genres eg ON e.id = eg.event_id
WHERE e.source = 'ticketmaster'
  AND eg.event_id IS NULL
ORDER BY e.date DESC;
```

---

## Appendix B: Ticketmaster Discovery API Reference

**Base URL:**
```
https://app.ticketmaster.com/discovery/v2
```

**Authentication:**
```
?apikey=YOUR_API_KEY
```

**Get Music Classifications:**
```
GET /classifications.json?segmentName=Music&apikey=YOUR_KEY
```

**Get Specific Genre:**
```
GET /classifications/genres/{genreId}.json?apikey=YOUR_KEY
```

**Event Search with Genre Filter:**
```
GET /events.json?classificationName={genreName}&apikey=YOUR_KEY
```

**Rate Limits:**
- 5000 API calls per day
- 5 requests per second

---

## Appendix C: Glossary

- **Genre**: A category of music (e.g., Rock, Electronic, Hip-Hop)
- **Subgenre**: A subcategory within a genre (e.g., House, Techno under Electronic)
- **Segment**: Top-level Ticketmaster category (e.g., Music, Sports, Theatre)
- **Classification**: The full hierarchy of segment → genre → subGenre
- **Primary classification**: The main genre assigned to an event
- **Normalized name**: Lowercase, slug-formatted version of genre name for matching

---

## Conclusion

This implementation plan provides a complete blueprint for adding music genre classification to the Events API. The approach:

✅ **Integrates seamlessly** with the normalized schema from PR #8  
✅ **Uses flexible architecture** with internal IDs + external Ticketmaster IDs  
✅ **Filters to music only** to maintain focus on music events  
✅ **Supports many-to-many** relationships between events and genres  
✅ **Includes comprehensive testing** and monitoring strategies  
✅ **Provides clear migration path** with rollback capability  

Follow the implementation checklist in Section 11 to execute this plan methodically. Each phase builds on the previous one, ensuring a stable, production-ready implementation.

**Next Steps:**
1. Review and approve this plan
2. Create database migration scripts
3. Implement TypeScript services
4. Add API endpoints
5. Test thoroughly
6. Deploy to production

---

**Document Version**: 1.0  
**Last Updated**: October 29, 2025  
**Author**: GitHub Copilot Coding Agent  
**Status**: Ready for Implementation
