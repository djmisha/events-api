/**
 * Artist Service
 *
 * Handles all database operations for the artists table.
 *
 * Features:
 * - CRUD operations for artists
 * - Search by ID or name
 * - Slug generation
 * - Batch synchronization from partner event data
 *
 * Performance Characteristics:
 * - Batch sync reduces queries from N to ~5 for 100 artists (95%+ reduction)
 * - Three-phase sync: parse → lookup → execute
 * - Optimized for serverless with minimal memory footprint
 * - UUID-based run IDs for distributed tracing and log correlation
 */

import { randomUUID } from "crypto";
import supabase from "./supabaseClient";
import logger from "./logger";
import { serializeError } from "../utils/errors";
import validate from "../utils/validate";
import { Artist, ArtistInput, ArtistSyncResult, ArtistSource } from "../types";

// Default pagination and search limits
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_SEARCH_LIMIT = 10;

/**
 * Normalize artist name for comparison (lowercase, trimmed)
 */
function normalizeArtistName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Generate a URL-friendly slug from an artist name
 * Removes special characters, replaces spaces with hyphens
 *
 * @param name - The artist name to convert
 * @returns URL-friendly slug
 * @example generateSlug("Daft Punk") => "daft-punk"
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Find an artist by ID (UUID)
 *
 * @param id - Artist UUID
 * @returns Artist object or null if not found
 */
export async function getArtistById(id: string): Promise<Artist | null> {
  try {
    const { data, error } = await supabase
      .from("artists")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    logger.error(
      { id, error: serializeError(error) },
      "Error fetching artist by ID"
    );
    throw error;
  }
}

/**
 * Find an artist by slug
 *
 * @param slug - URL-friendly artist identifier
 * @returns Artist object or null if not found
 */
export async function getArtistBySlug(slug: string): Promise<Artist | null> {
  try {
    const { data, error } = await supabase
      .from("artists")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    logger.error(
      { slug, error: serializeError(error) },
      "Error fetching artist by slug"
    );
    throw error;
  }
}

/**
 * Find an artist by external ID (EDM Train or Ticketmaster)
 *
 * @param source - Data source ("edmtrain" or "ticketmaster")
 * @param externalId - The external API's artist ID
 * @returns Artist object or null if not found
 */
export async function getArtistByExternalId(
  source: ArtistSource,
  externalId: string | number
): Promise<Artist | null> {
  try {
    const column = source === "edmtrain" ? "edmtrain_id" : "ticketmaster_id";
    const value =
      source === "edmtrain" ? Number(externalId) : String(externalId);

    const { data, error } = await supabase
      .from("artists")
      .select("*")
      .eq(column, value)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    logger.error(
      { source, externalId, error: serializeError(error) },
      "Error fetching artist by external ID"
    );
    throw error;
  }
}

/**
 * Search artists by name (case-insensitive partial match)
 *
 * @param name - Search query string
 * @param limit - Maximum number of results (default: 10)
 * @returns Array of matching artists sorted by name
 * @throws Error if database query fails
 */
export async function searchArtistsByName(
  name: string,
  limit = DEFAULT_SEARCH_LIMIT
): Promise<Artist[]> {
  try {
    const { data, error } = await supabase
      .from("artists")
      .select("*")
      .ilike("name", `%${name}%`)
      .order("name")
      .limit(limit);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error(
      { name, limit, error: serializeError(error) },
      "Error searching artists by name"
    );
    throw error;
  }
}

/**
 * Get all artists with pagination
 *
 * @param page - Page number (1-indexed, default: 1)
 * @param limit - Results per page (default: 50)
 * @returns Object with artists array and total count
 * @throws Error if database query fails
 */
export async function getAllArtists(
  page = 1,
  limit = DEFAULT_PAGE_SIZE
): Promise<{ artists: Artist[]; total: number }> {
  try {
    const offset = (page - 1) * limit;

    // Get total count
    const { count } = await supabase
      .from("artists")
      .select("*", { count: "exact", head: true });

    // Get paginated data
    const { data, error } = await supabase
      .from("artists")
      .select("*")
      .order("name")
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return {
      artists: data || [],
      total: count || 0,
    };
  } catch (error) {
    logger.error(
      { page, limit, error: serializeError(error) },
      "Error fetching all artists"
    );
    throw error;
  }
}

/**
 * Create a new artist
 * Validates input and auto-generates slug if not provided
 *
 * @param input - Artist data to create
 * @returns Newly created artist
 * @throws Error if validation fails or database operation fails
 */
export async function createArtist(input: ArtistInput): Promise<Artist> {
  try {
    // Validate input
    const validatedInput = validate.validateArtistInput(input);
    const slug = validatedInput.slug || generateSlug(validatedInput.name);

    const { data, error } = await supabase
      .from("artists")
      .insert({
        name: validatedInput.name,
        slug,
        image: validatedInput.image || null,
        tags: validatedInput.tags || [],
        ticketmaster_id: validatedInput.ticketmaster_id || null,
        edmtrain_id: validatedInput.edmtrain_id || null,
        bio: validatedInput.bio || null,
        metadata: validatedInput.metadata || {},
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info(
      {
        name: validatedInput.name,
        slug,
        ticketmaster_id: validatedInput.ticketmaster_id ?? null,
        edmtrain_id: validatedInput.edmtrain_id ?? null,
      },
      "Created new artist"
    );
    return data;
  } catch (error) {
    logger.error(
      {
        input: {
          name: input.name,
          slug: input.slug ?? null,
          ticketmaster_id: input.ticketmaster_id ?? null,
          edmtrain_id: input.edmtrain_id ?? null,
        },
        error: serializeError(error),
      },
      "Error creating artist"
    );
    throw error;
  }
}

/**
 * Update an existing artist (merge data, never delete fields)
 * Only updates fields that are provided and non-null
 *
 * @param id - Artist UUID
 * @param input - Partial artist data to update
 * @returns Updated artist
 * @throws Error if validation fails or artist not found
 */
export async function updateArtist(
  id: string,
  input: Partial<ArtistInput>
): Promise<Artist> {
  try {
    // Validate input
    const validatedInput = validate.validateArtistUpdate(input);

    // Build update object only with non-null values
    const updateData: Record<string, unknown> = {};

    if (validatedInput.name !== undefined) {
      updateData.name = validatedInput.name;
    }
    if (validatedInput.slug !== undefined) {
      updateData.slug = validatedInput.slug;
    }
    if (validatedInput.image !== undefined && validatedInput.image !== null) {
      updateData.image = validatedInput.image;
    }
    if (validatedInput.tags !== undefined && validatedInput.tags.length > 0) {
      updateData.tags = validatedInput.tags;
    }
    if (
      validatedInput.ticketmaster_id !== undefined &&
      validatedInput.ticketmaster_id !== null
    ) {
      updateData.ticketmaster_id = validatedInput.ticketmaster_id;
    }
    if (
      validatedInput.edmtrain_id !== undefined &&
      validatedInput.edmtrain_id !== null
    ) {
      updateData.edmtrain_id = validatedInput.edmtrain_id;
    }
    if (validatedInput.bio !== undefined && validatedInput.bio !== null) {
      updateData.bio = validatedInput.bio;
    }
    if (validatedInput.metadata !== undefined) {
      updateData.metadata = validatedInput.metadata;
    }

    const { data, error } = await supabase
      .from("artists")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info({ id, fields: Object.keys(updateData) }, "Updated artist");
    return data;
  } catch (error) {
    logger.error(
      { id, input, error: serializeError(error) },
      "Error updating artist"
    );
    throw error;
  }
}

// ============================================================================
// SYNC HELPERS - Breaking down syncArtistsFromEvents into manageable pieces
// ============================================================================

/**
 * Candidate for artist sync - intermediate representation before database operations
 */
interface SyncCandidate {
  name: string;
  slug: string;
  source: ArtistSource;
  ticketmaster_id?: string;
  edmtrain_id?: number;
  external_id: string;
}

/**
 * PHASE 1: Parse raw event artists into validated sync candidates
 *
 * This function:
 * 1. Deduplicates inputs by external_id or normalized name (reduces DB calls)
 * 2. Parses external_id format ("source:id") and validates structure
 * 3. Determines source (edmtrain vs ticketmaster) from ID format
 * 4. Filters out invalid records (accumulates errors)
 *
 * Performance: O(n) complexity, single pass with Map for deduplication
 *
 * @param artists - Raw artist data from partner events
 * @param source - Default source if not in external_id
 * @param runId - UUID for logging correlation
 * @param result - Accumulator for error counts
 * @returns Array of validated sync candidates ready for database lookup
 */
function parseSyncCandidates(
  artists: Array<{ external_id: string; name: string }>,
  source: ArtistSource,
  runId: string,
  result: ArtistSyncResult
): SyncCandidate[] {
  // Dedupe inputs to reduce DB calls (same artist may appear in many events)
  const dedupedArtists = Array.from(
    artists
      .reduce((map, artist) => {
        const external = artist.external_id?.trim();
        const key = external
          ? `external:${external}`
          : `name:${normalizeArtistName(artist.name)}`;

        if (!map.has(key)) {
          map.set(key, artist);
        }

        return map;
      }, new Map<string, { external_id: string; name: string }>())
      .values()
  );

  const candidates: SyncCandidate[] = [];

  dedupedArtists.forEach((artist) => {
    try {
      const externalIdParts = artist.external_id?.split(":") || [];
      const rawSource = externalIdParts[0];
      const externalId = externalIdParts[1];

      const artistSource: ArtistSource =
        rawSource === "edmtrain" || rawSource === "ticketmaster"
          ? rawSource
          : source;

      const slug = generateSlug(artist.name);
      const candidate: SyncCandidate = {
        name: artist.name,
        slug,
        source: artistSource,
        external_id: artist.external_id,
      };

      if (artistSource === "edmtrain" && externalId) {
        const parsedId = Number(externalId);
        if (!Number.isNaN(parsedId) && Number.isInteger(parsedId)) {
          candidate.edmtrain_id = parsedId;
        }
      }

      if (artistSource === "ticketmaster" && externalId) {
        candidate.ticketmaster_id = externalId;
      }

      // If we couldn't parse a usable external ID, skip this record
      if (!candidate.edmtrain_id && !candidate.ticketmaster_id) {
        result.errors += 1;
        logger.warn(
          {
            runId,
            source,
            artistName: artist.name,
            external_id: artist.external_id,
          },
          "Skipping artist sync (invalid external_id)"
        );
        return;
      }

      candidates.push(candidate);
    } catch (parseError) {
      result.errors += 1;
      logger.error(
        {
          runId,
          source,
          artistName: artist.name,
          external_id: artist.external_id,
          error: serializeError(parseError),
        },
        "Error parsing artist for sync"
      );
    }
  });

  return candidates;
}

/**
 * Existing artist record (subset of fields needed for sync logic)
 */
type ExistingArtist = Pick<
  Artist,
  "id" | "slug" | "name" | "ticketmaster_id" | "edmtrain_id"
>;

/**
 * PHASE 2: Batch lookup existing artists by external IDs and slugs
 *
 * This function performs 3 optimized database queries instead of N individual lookups:
 * 1. IN query for Ticketmaster IDs (if any candidates have them)
 * 2. IN query for EDM Train IDs (if any candidates have them)
 * 3. IN query for slugs (for name-based fallback matching)
 *
 * Performance:
 * - Before: N queries (one per artist) → ~100 queries for 100 artists
 * - After: 3 queries total → 97% reduction in database round trips
 *
 * The function returns three Maps for O(1) lookup during the execute phase.
 *
 * @param candidates - Validated sync candidates from Phase 1
 * @param runId - UUID for logging correlation
 * @param source - Data source for error logging
 * @returns Three Maps of existing artists indexed by ticketmaster_id, edmtrain_id, and slug
 * @throws Error if database queries fail (logged and re-thrown)
 */
async function batchLookupExistingArtists(
  candidates: SyncCandidate[],
  runId: string,
  source: ArtistSource
): Promise<{
  byTicketmasterId: Map<string, ExistingArtist>;
  byEdmtrainId: Map<number, ExistingArtist>;
  bySlug: Map<string, ExistingArtist>;
}> {
  const ticketmasterIds = Array.from(
    new Set(
      candidates
        .map((c) => c.ticketmaster_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );
  const edmtrainIds = Array.from(
    new Set(
      candidates
        .map((c) => c.edmtrain_id)
        .filter((id): id is number => typeof id === "number")
    )
  );

  const byTicketmasterId = new Map<string, ExistingArtist>();
  const byEdmtrainId = new Map<number, ExistingArtist>();
  const bySlug = new Map<string, ExistingArtist>();

  try {
    // Lookup by Ticketmaster IDs
    if (ticketmasterIds.length > 0) {
      const { data, error } = await supabase
        .from("artists")
        .select("id, slug, name, ticketmaster_id, edmtrain_id")
        .in("ticketmaster_id", ticketmasterIds);

      if (error) throw error;
      (data || []).forEach((a) => {
        if (a.ticketmaster_id) {
          byTicketmasterId.set(a.ticketmaster_id, a);
        }
      });
    }

    // Lookup by EDM Train IDs
    if (edmtrainIds.length > 0) {
      const { data, error } = await supabase
        .from("artists")
        .select("id, slug, name, ticketmaster_id, edmtrain_id")
        .in("edmtrain_id", edmtrainIds);

      if (error) throw error;
      (data || []).forEach((a) => {
        if (a.edmtrain_id !== null && a.edmtrain_id !== undefined) {
          byEdmtrainId.set(a.edmtrain_id, a);
        }
      });
    }

    // Lookup by slugs for name-based matching
    const candidatesNeedingSlugLookup = candidates.filter((c) => {
      if (c.ticketmaster_id && byTicketmasterId.has(c.ticketmaster_id)) {
        return false;
      }
      if (
        typeof c.edmtrain_id === "number" &&
        byEdmtrainId.has(c.edmtrain_id)
      ) {
        return false;
      }
      return true;
    });

    const slugsToLookup = Array.from(
      new Set(
        candidatesNeedingSlugLookup
          .map((c) => c.slug)
          .filter((s) => typeof s === "string" && s.length > 0)
      )
    );

    if (slugsToLookup.length > 0) {
      const { data, error } = await supabase
        .from("artists")
        .select("id, slug, name, ticketmaster_id, edmtrain_id")
        .in("slug", slugsToLookup);

      if (error) throw error;
      (data || []).forEach((a) => bySlug.set(a.slug, a));
    }
  } catch (lookupError) {
    logger.error(
      { runId, source, error: serializeError(lookupError) },
      "Error looking up existing artists"
    );
    throw lookupError;
  }

  return { byTicketmasterId, byEdmtrainId, bySlug };
}

/**
 * PHASE 3: Execute bulk database operations for artist sync
 *
 * This function builds and executes two batch upsert operations:
 * 1. New artists - upsert by slug (creates if not exists, updates if exists)
 * 2. Updated artists - upsert by id (only fills in missing external IDs)
 *
 * Upsert Strategy:
 * - For new artists: Insert with all available data
 * - For existing artists: Only update fields that are currently null/empty
 * - Never overwrites existing data (append-only enrichment)
 *
 * Performance:
 * - Before: N individual upserts → 100 queries for 100 artists
 * - After: 2 batch upserts → 98% reduction in operations
 *
 * Error Handling:
 * - Errors per batch, not per record (maintains batch atomicity)
 * - Failed batches are logged and counted but don't stop the sync
 *
 * @param candidates - Validated sync candidates from Phase 1
 * @param existingMaps - Lookup maps from Phase 2
 * @param result - Accumulator for operation counts (created/updated/skipped/errors)
 * @param runId - UUID for logging correlation
 * @param source - Data source for error logging
 */
async function executeBulkArtistOperations(
  candidates: SyncCandidate[],
  existingMaps: {
    byTicketmasterId: Map<string, ExistingArtist>;
    byEdmtrainId: Map<number, ExistingArtist>;
    bySlug: Map<string, ExistingArtist>;
  },
  result: ArtistSyncResult,
  runId: string,
  source: ArtistSource
): Promise<void> {
  const { byTicketmasterId, byEdmtrainId, bySlug } = existingMaps;

  const insertsBySlug = new Map<string, ArtistInput>();
  const updatesById = new Map<string, Partial<ArtistInput> & { id: string }>();

  candidates.forEach((c) => {
    const existing =
      (c.ticketmaster_id && byTicketmasterId.get(c.ticketmaster_id)) ||
      (typeof c.edmtrain_id === "number" && byEdmtrainId.get(c.edmtrain_id)) ||
      bySlug.get(c.slug);

    if (!existing) {
      // New artist - prepare for insert
      const insert: ArtistInput = {
        name: c.name,
        slug: c.slug,
        metadata: { source: c.source },
        ticketmaster_id: c.ticketmaster_id ?? null,
        edmtrain_id: c.edmtrain_id ?? null,
      };
      insertsBySlug.set(c.slug, insert);
      return;
    }

    // Existing artist - prepare for update if missing external IDs
    const update: Partial<ArtistInput> & { id: string } = { id: existing.id };
    if (c.ticketmaster_id && !existing.ticketmaster_id) {
      update.ticketmaster_id = c.ticketmaster_id;
    }
    if (typeof c.edmtrain_id === "number" && !existing.edmtrain_id) {
      update.edmtrain_id = c.edmtrain_id;
    }

    const hasUpdate =
      update.ticketmaster_id !== undefined || update.edmtrain_id !== undefined;

    if (hasUpdate) {
      const prior = updatesById.get(existing.id) || { id: existing.id };
      updatesById.set(existing.id, { ...prior, ...update });
      return;
    }

    result.skipped += 1;
  });

  const inserts = Array.from(insertsBySlug.values());
  const updates = Array.from(updatesById.values()).map((u) => {
    // Only include columns that are actually being set
    const record: Record<string, unknown> = { id: u.id };
    if (u.ticketmaster_id !== undefined) {
      record.ticketmaster_id = u.ticketmaster_id;
    }
    if (u.edmtrain_id !== undefined) record.edmtrain_id = u.edmtrain_id;
    return record;
  });

  // Bulk upsert new artists by slug
  if (inserts.length > 0) {
    try {
      const { error } = await supabase
        .from("artists")
        .upsert(inserts, { onConflict: "slug" });
      if (error) throw error;
      result.created += inserts.length;
    } catch (insertError) {
      logger.error(
        {
          runId,
          source,
          error: serializeError(insertError),
          count: inserts.length,
        },
        "Error bulk upserting new artists"
      );
      result.errors += inserts.length;
    }
  }

  // Bulk update existing artists by id
  if (updates.length > 0) {
    try {
      const { error } = await supabase
        .from("artists")
        .upsert(updates, { onConflict: "id" });
      if (error) throw error;
      result.updated += updates.length;
    } catch (updateError) {
      logger.error(
        {
          runId,
          source,
          error: serializeError(updateError),
          count: updates.length,
        },
        "Error bulk updating existing artists"
      );
      result.errors += updates.length;
    }
  }
}

/**
 * Sync artists from event data to the master artists table
 * Called during partner data fetch to sync only the artists from current events
 *
 * This function orchestrates a three-step process:
 * 1. Parse and validate artist data from events (deduplication, external ID parsing)
 * 2. Batch lookup existing artists (by external IDs and slugs)
 * 3. Execute bulk database operations (upsert new, update existing)
 *
 * @param artists - Array of artist objects from events (with external_id in "source:id" format)
 * @param source - The data source ("edmtrain" or "ticketmaster")
 * @returns Summary of sync operations (created, updated, skipped, errors)
 *
 * @example
 * const result = await syncArtistsFromEvents(
 *   [{ external_id: "edmtrain:12345", name: "Daft Punk" }],
 *   "edmtrain"
 * );
 * // result: { created: 1, updated: 0, skipped: 0, errors: 0 }
 */
export async function syncArtistsFromEvents(
  artists: Array<{ external_id: string; name: string }>,
  source: ArtistSource
): Promise<ArtistSyncResult> {
  const result: ArtistSyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  if (!artists || artists.length === 0) {
    return result;
  }

  const runId = randomUUID();

  // Step 1: Parse and validate candidates
  const candidates = parseSyncCandidates(artists, source, runId, result);

  if (candidates.length === 0) {
    return result;
  }

  // Step 2: Batch lookup existing artists
  let existingMaps;
  try {
    existingMaps = await batchLookupExistingArtists(candidates, runId, source);
  } catch (lookupError) {
    logger.error(
      { runId, source, error: serializeError(lookupError) },
      "Fatal error during artist lookup - aborting sync"
    );
    result.errors += candidates.length;
    return result;
  }

  // Step 3: Execute bulk operations
  await executeBulkArtistOperations(
    candidates,
    existingMaps,
    result,
    runId,
    source
  );

  return result;
}
