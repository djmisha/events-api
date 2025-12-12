/**
 * Artist Service
 *
 * Handles all database operations for the artists table.
 * Features:
 * - CRUD operations for artists
 * - Search by ID or name
 * - Slug generation
 * - Deduplication logic
 */

import supabase from "./supabaseClient";
import logger from "./logger";
import { Artist, ArtistInput, ArtistSyncResult } from "../types";

/**
 * Generate a URL-friendly slug from an artist name
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
    logger.error("Error fetching artist by ID:", { id, error });
    throw error;
  }
}

/**
 * Find an artist by slug
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
    logger.error("Error fetching artist by slug:", { slug, error });
    throw error;
  }
}

/**
 * Find an artist by external ID (EDM Train or Ticketmaster)
 */
export async function getArtistByExternalId(
  source: "edmtrain" | "ticketmaster",
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
    logger.error("Error fetching artist by external ID:", {
      source,
      externalId,
      error,
    });
    throw error;
  }
}

/**
 * Search artists by name (case-insensitive partial match)
 */
export async function searchArtistsByName(
  name: string,
  limit = 10
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
    logger.error("Error searching artists by name:", { name, error });
    throw error;
  }
}

/**
 * Get all artists with pagination
 */
export async function getAllArtists(
  page = 1,
  limit = 50
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
    logger.error("Error fetching all artists:", { page, limit, error });
    throw error;
  }
}

/**
 * Create a new artist
 */
export async function createArtist(input: ArtistInput): Promise<Artist> {
  try {
    const slug = input.slug || generateSlug(input.name);

    const { data, error } = await supabase
      .from("artists")
      .insert({
        name: input.name,
        slug,
        image: input.image || null,
        tags: input.tags || [],
        ticketmaster_id: input.ticketmaster_id || null,
        edmtrain_id: input.edmtrain_id || null,
        bio: input.bio || null,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info("Created new artist:", { name: input.name, slug });
    return data;
  } catch (error) {
    logger.error("Error creating artist:", { input, error });
    throw error;
  }
}

/**
 * Update an existing artist (merge data, never delete fields)
 */
export async function updateArtist(
  id: string,
  input: Partial<ArtistInput>
): Promise<Artist> {
  try {
    // Build update object only with non-null values
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.slug !== undefined) {
      updateData.slug = input.slug;
    }
    if (input.image !== undefined && input.image !== null) {
      updateData.image = input.image;
    }
    if (input.tags !== undefined && input.tags.length > 0) {
      updateData.tags = input.tags;
    }
    if (input.ticketmaster_id !== undefined && input.ticketmaster_id !== null) {
      updateData.ticketmaster_id = input.ticketmaster_id;
    }
    if (input.edmtrain_id !== undefined && input.edmtrain_id !== null) {
      updateData.edmtrain_id = input.edmtrain_id;
    }
    if (input.bio !== undefined && input.bio !== null) {
      updateData.bio = input.bio;
    }
    if (input.metadata !== undefined) {
      updateData.metadata = input.metadata;
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

    logger.info("Updated artist:", { id, fields: Object.keys(updateData) });
    return data;
  } catch (error) {
    logger.error("Error updating artist:", { id, input, error });
    throw error;
  }
}

/**
 * Upsert an artist - create if not exists, update if more data available
 * Used by the sync job to handle deduplication
 */
export async function upsertArtist(
  input: ArtistInput,
  source: "edmtrain" | "ticketmaster"
): Promise<{ artist: Artist; action: "created" | "updated" | "skipped" }> {
  try {
    // First, check if artist exists by external ID
    const externalId =
      source === "edmtrain" ? input.edmtrain_id : input.ticketmaster_id;

    let existingArtist: Artist | null = null;

    if (externalId) {
      existingArtist = await getArtistByExternalId(source, externalId);
    }

    // If not found by external ID, try to find by name (fuzzy match)
    if (!existingArtist) {
      const { data } = await supabase
        .from("artists")
        .select("*")
        .ilike("name", input.name)
        .limit(1);

      if (data && data.length > 0) {
        [existingArtist] = data;
      }
    }

    if (existingArtist) {
      // Check if we have new data to add
      const hasNewData =
        (!existingArtist.image && input.image) ||
        (!existingArtist.bio && input.bio) ||
        (!existingArtist.ticketmaster_id && input.ticketmaster_id) ||
        (!existingArtist.edmtrain_id && input.edmtrain_id) ||
        (input.tags &&
          input.tags.length > 0 &&
          existingArtist.tags.length === 0);

      if (hasNewData) {
        // Merge new data into existing artist
        const updatedArtist = await updateArtist(existingArtist.id, {
          image: input.image || undefined,
          bio: input.bio || undefined,
          ticketmaster_id: input.ticketmaster_id || undefined,
          edmtrain_id: input.edmtrain_id || undefined,
          tags: input.tags && input.tags.length > 0 ? input.tags : undefined,
        });
        return { artist: updatedArtist, action: "updated" };
      }

      // No new data to add, skip
      return { artist: existingArtist, action: "skipped" };
    }

    // Create new artist
    const newArtist = await createArtist(input);
    return { artist: newArtist, action: "created" };
  } catch (error) {
    logger.error("Error upserting artist:", { input, source, error });
    throw error;
  }
}

/**
 * Sync artists from event data to the master artists table
 * This is called during partner data fetch to sync only the artists from current events
 *
 * @param artists - Array of artist objects from events (with external_id in "source:id" format)
 * @param source - The data source ("edmtrain" or "ticketmaster")
 */
export async function syncArtistsFromEvents(
  artists: Array<{ external_id: string; name: string }>,
  source: "edmtrain" | "ticketmaster"
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

  logger.info(
    `Synchronizing ${artists.length} artists from ${source} events to master artists table`
  );

  // Process each artist with batching
  const processArtist = async (artist: {
    external_id: string;
    name: string;
  }): Promise<"created" | "updated" | "skipped" | "error"> => {
    try {
      // Parse external ID from the external_id field (format: "source:id")
      const externalIdParts = artist.external_id?.split(":") || [];
      const rawSource = externalIdParts[0];
      const externalId = externalIdParts[1];

      // Validate source before type assertion
      const validSources = ["edmtrain", "ticketmaster"];
      const artistSource: "edmtrain" | "ticketmaster" = validSources.includes(
        rawSource
      )
        ? (rawSource as "edmtrain" | "ticketmaster")
        : source; // Fallback to provided source

      const input: ArtistInput = {
        name: artist.name,
        metadata: { source: artistSource },
      };

      // Set external ID based on source with proper validation
      if (artistSource === "edmtrain" && externalId) {
        const parsedId = Number(externalId);
        if (!Number.isNaN(parsedId) && Number.isInteger(parsedId)) {
          input.edmtrain_id = parsedId;
        }
      } else if (artistSource === "ticketmaster" && externalId) {
        input.ticketmaster_id = externalId;
      }

      const { action } = await upsertArtist(input, artistSource);
      return action;
    } catch (artistError) {
      logger.error("Error syncing individual artist:", {
        artist: artist.name,
        error: artistError,
      });
      return "error";
    }
  };

  // Process artists in batches to avoid overwhelming the database
  const BATCH_SIZE = 10;
  const artistBatches: (typeof artists)[] = [];
  const artistArray = [...artists];
  while (artistArray.length > 0) {
    artistBatches.push(artistArray.splice(0, BATCH_SIZE));
  }

  // Process batches sequentially, artists within batch in parallel
  const allResults: Array<"created" | "updated" | "skipped" | "error"> = [];
  await artistBatches.reduce(async (prevPromise, batch) => {
    await prevPromise;
    const batchResults = await Promise.all(batch.map(processArtist));
    allResults.push(...batchResults);
  }, Promise.resolve());

  // Count results
  allResults.forEach((action) => {
    if (action === "created") {
      result.created += 1;
    } else if (action === "updated") {
      result.updated += 1;
    } else if (action === "skipped") {
      result.skipped += 1;
    } else {
      result.errors += 1;
    }
  });

  logger.info("Artist sync from events completed:", result);
  return result;
}

/**
 * Sync artists from prtnr_artists table
 * This is used by the background job to populate the artists table
 * @deprecated Use syncArtistsFromEvents instead for better performance
 */
export async function syncArtistsFromPartnerTable(): Promise<ArtistSyncResult> {
  const result: ArtistSyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Fetch all artists from prtnr_artists with their metadata
    const { data: partnerArtists, error } = await supabase
      .from("prtnr_artists")
      .select("*");

    if (error) {
      logger.error("Error fetching partner artists:", error);
      throw error;
    }

    if (!partnerArtists || partnerArtists.length === 0) {
      logger.info("No partner artists found to sync");
      return result;
    }

    logger.info(
      `Synchronizing ${partnerArtists.length} artists from partner table`
    );

    // Process each artist using Promise.allSettled with batching
    const processArtist = async (partnerArtist: {
      external_id?: string;
      name: string;
      metadata?: Record<string, unknown>;
    }): Promise<"created" | "updated" | "skipped" | "error"> => {
      try {
        // Parse external ID from the external_id field (format: "source:id")
        const externalIdParts = partnerArtist.external_id?.split(":") || [];
        const rawSource = externalIdParts[0];
        const externalId = externalIdParts[1];

        // Validate source before type assertion
        const validSources = ["edmtrain", "ticketmaster"];
        const source: "edmtrain" | "ticketmaster" = validSources.includes(
          rawSource
        )
          ? (rawSource as "edmtrain" | "ticketmaster")
          : "edmtrain";

        const input: ArtistInput = {
          name: partnerArtist.name,
          metadata: partnerArtist.metadata || {},
        };

        // Set external ID based on source with proper validation
        if (source === "edmtrain" && externalId) {
          const parsedId = Number(externalId);
          if (!Number.isNaN(parsedId) && Number.isInteger(parsedId)) {
            input.edmtrain_id = parsedId;
          }
        } else if (source === "ticketmaster" && externalId) {
          input.ticketmaster_id = externalId;
        }

        const { action } = await upsertArtist(input, source);
        return action;
      } catch (artistError) {
        logger.error("Error syncing individual artist:", {
          artist: partnerArtist.name,
          error: artistError,
        });
        return "error";
      }
    };

    // Process artists in batches to avoid overwhelming the database
    const BATCH_SIZE = 10;
    const artistBatches: (typeof partnerArtists)[] = [];
    const artistArray = [...partnerArtists];
    while (artistArray.length > 0) {
      artistBatches.push(artistArray.splice(0, BATCH_SIZE));
    }

    // Process batches sequentially, artists within batch in parallel
    const allResults: Array<"created" | "updated" | "skipped" | "error"> = [];
    await artistBatches.reduce(async (prevPromise, batch) => {
      await prevPromise;
      const batchResults = await Promise.all(batch.map(processArtist));
      allResults.push(...batchResults);
    }, Promise.resolve());

    // Count results
    allResults.forEach((action) => {
      if (action === "created") {
        result.created += 1;
      } else if (action === "updated") {
        result.updated += 1;
      } else if (action === "skipped") {
        result.skipped += 1;
      } else {
        result.errors += 1;
      }
    });

    logger.info("Artist sync completed:", result);
    return result;
  } catch (error) {
    logger.error("Error syncing artists from partner table:", error);
    throw error;
  }
}

export default {
  generateSlug,
  getArtistById,
  getArtistBySlug,
  getArtistByExternalId,
  searchArtistsByName,
  getAllArtists,
  createArtist,
  updateArtist,
  upsertArtist,
  syncArtistsFromEvents,
  syncArtistsFromPartnerTable,
};
