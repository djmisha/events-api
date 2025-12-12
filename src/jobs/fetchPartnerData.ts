/**
 * Partner Data Fetch Job
 *
 * Fetches events from EDM Train and Ticketmaster APIs, transforms them,
 * stores in normalized database schema, syncs artists, assigns genres, and cleans up old data.
 *
 * Features:
 * - Fetches only Music events from Ticketmaster (segmentId filter)
 * - Uses normalized schema (prtnr_events, prtnr_venues, prtnr_artists, prtnr_event_artists)
 * - Batch upserts for optimal performance (venues, artists, events, genres)
 * - Automatic artist sync to master artists table (integrated)
 * - Automatic genre assignment based on API classifications
 * - Creates missing genres on-the-fly from Ticketmaster data
 * - Automatic cleanup of events older than 3 days
 * - Removes orphaned venues and artists
 *
 * Database Operations per Webhook:
 * - Upsert venues, artists, events (batch operations)
 * - Sync artists to master table (batch operations, 10 at a time)
 * - Fetch/create genres and assign to events (2-3 queries total)
 * - Delete old events and orphaned records (2-4 queries total)
 * - Total: ~10-15 queries for 100+ events
 */

import edmTrainService from "../services/edmTrain";
import ticketmasterService from "../services/ticketmaster";
import supabase from "../services/supabaseClient";
import cacheControl from "../services/cacheControl";
import transform from "../utils/transform";
import logger from "../services/logger";
import artistService from "../services/artist";
import { PartnerEvent } from "../types";
import { upsertEventsWithRelations } from "../services/normalizedDataBatch";

/**
 * Clean up old events for a specific location.
 * Deletes events older than 3 days. Related records deleted via CASCADE.
 *
 * @param locationId - The location ID to clean up
 * @returns Number of events deleted
 */
const cleanupOldEvents = async (locationId: number): Promise<number> => {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const cutoffDate = threeDaysAgo.toISOString().split("T")[0]; // Format: YYYY-MM-DD

    // First, get the IDs of events to delete
    const { data: eventsToDelete, error: fetchError } = await supabase
      .from("prtnr_events")
      .select("id")
      .eq("location_id", locationId)
      .lt("date", cutoffDate);

    if (fetchError) {
      logger.error("Failed to fetch old events for cleanup", {
        error: fetchError.message,
        locationId,
        cutoffDate,
      });
      return 0; // Don't throw - cleanup failure shouldn't break the entire job
    }

    if (!eventsToDelete || eventsToDelete.length === 0) {
      logger.debug(`No old events to clean up for location ${locationId}`);
      return 0;
    }

    const eventCount = eventsToDelete.length;
    logger.info(
      `Found ${eventCount} old events to delete for location ${locationId}`
    );

    // Delete the events - CASCADE will automatically delete related records:
    // - prtnr_event_artists (event-artist relationships)
    // - prtnr_event_genres (event-genre relationships)
    const { error: deleteError } = await supabase
      .from("prtnr_events")
      .delete()
      .eq("location_id", locationId)
      .lt("date", cutoffDate);

    if (deleteError) {
      logger.error("Failed to delete old events", {
        error: deleteError.message,
        locationId,
        count: eventCount,
      });
      return 0;
    }

    logger.info(
      `Successfully deleted ${eventCount} old events for location ${locationId} (date < ${cutoffDate})`
    );
    return eventCount;
  } catch (error) {
    logger.error("Cleanup old events failed", {
      error: error instanceof Error ? error.message : String(error),
      locationId,
    });
    return 0; // Don't throw - cleanup failure shouldn't break the entire job
  }
};

/**
 * Clean up orphaned venues and artists with no associated events.
 * Runs globally across all locations.
 * Only executes if old events were actually deleted to improve performance.
 *
 * @param deletedEventCount - Number of events that were deleted
 */
const cleanupOrphanedRecords = async (
  deletedEventCount: number
): Promise<void> => {
  // Skip if no events were deleted (optimization)
  if (deletedEventCount === 0) {
    logger.debug("Skipping orphaned cleanup - no events were deleted");
    return;
  }

  try {
    // Clean up orphaned venues (venues with no events)
    const { data: venuesToDelete } = await supabase
      .from("prtnr_venues")
      .select("id")
      .not(
        "id",
        "in",
        `(SELECT DISTINCT venue_id FROM prtnr_events WHERE venue_id IS NOT NULL)`
      );

    if (venuesToDelete && venuesToDelete.length > 0) {
      const venueIds = venuesToDelete.map((v) => v.id);
      await supabase.from("prtnr_venues").delete().in("id", venueIds);
      logger.info(`Deleted ${venueIds.length} orphaned venues`);
    } else {
      logger.debug("No orphaned venues to clean up");
    }

    // Clean up orphaned artists (artists with no event associations)
    const { data: artistsToDelete } = await supabase
      .from("prtnr_artists")
      .select("id")
      .not(
        "id",
        "in",
        `(SELECT DISTINCT artist_id FROM prtnr_event_artists WHERE artist_id IS NOT NULL)`
      );

    if (artistsToDelete && artistsToDelete.length > 0) {
      const artistIds = artistsToDelete.map((a) => a.id);
      await supabase.from("prtnr_artists").delete().in("id", artistIds);
      logger.info(`Deleted ${artistIds.length} orphaned artists`);
    } else {
      logger.debug("No orphaned artists to clean up");
    }
  } catch (error) {
    logger.error("Cleanup orphaned records failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - cleanup failure shouldn't break the entire job
  }
};

export const execute = async (
  cityId: number,
  cityName: string
): Promise<void> => {
  logger.info(`Starting data fetch for ${cityName} (ID: ${cityId})`);

  try {
    const results = await Promise.allSettled([
      ticketmasterService.fetchEvents(cityId, cityName),
      edmTrainService.fetchEvents(cityId, cityName),
    ]);

    // Process Ticketmaster first to ensure genres are created, then EDM Train
    await processSourceUpdate(results[0], "ticketmaster", cityId, cityName);
    await processSourceUpdate(results[1], "edmtrain", cityId, cityName);

    // Cleanup old events and get count of deleted events
    const deletedCount = await cleanupOldEvents(cityId);

    // Only run orphaned cleanup if events were actually deleted (optimization)
    await cleanupOrphanedRecords(deletedCount);

    await cacheControl.updateCacheTimestamp(cityId);
    logger.info(`Completed data fetch for ${cityName} (ID: ${cityId})`);
  } catch (error) {
    logger.error(`Data fetch failed for ${cityName} (ID: ${cityId})`, {
      error: error instanceof Error ? error.message : String(error),
      cityId,
    });
    throw error;
  }
};

const processSourceUpdate = async (
  result: PromiseSettledResult<any[]>,
  source: "edmtrain" | "ticketmaster",
  cityId: number,
  cityName: string
): Promise<void> => {
  if (result.status === "rejected") {
    logger.error(`${source} API failed for ${cityName}:`, result.reason);
    return;
  }

  const events = result.value;
  if (!events || events.length === 0) {
    logger.info(`No ${source} events found for ${cityName}`);
    return;
  }

  // Transform events based on source
  let transformedEvents: PartnerEvent[];
  if (source === "edmtrain") {
    transformedEvents = transform.normalizeEdmTrainEvents(events, cityId);
  } else {
    transformedEvents = transform.normalizeTicketmasterEvents(events, cityId);
  }

  if (transformedEvents.length === 0) {
    logger.info(
      `No valid ${source} events after transformation for ${cityName}`
    );
    return;
  }

  // Use normalized batch upsert to handle venues, artists, and events
  // Cast to compatible type for normalizedDataBatch (converts null to undefined)
  const eventsForBatch = transformedEvents.map((event) => ({
    ...event,
    link: event.link || undefined,
    ages: event.ages || undefined,
    starttime: event.starttime || undefined,
    endtime: event.endtime || undefined,
  }));

  const upsertResult = await upsertEventsWithRelations(eventsForBatch, source);

  if (upsertResult.failed > 0) {
    logger.error({
      msg: `Some ${source} events failed to insert`,
      success: upsertResult.success,
      failed: upsertResult.failed,
      source,
      cityId,
      cityName,
    });
    throw new Error(
      `Failed to insert ${upsertResult.failed} of ${transformedEvents.length} ${source} events`
    );
  }

  logger.info(
    `Successfully upserted ${upsertResult.success} ${source} events for ${cityName} (ID: ${cityId})`
  );

  // Sync artists to master artists table from the events just processed
  await syncArtistsToMasterTable(transformedEvents, source);

  await assignGenresToEvents(transformedEvents, source);
};

/**
 * Sync artists from processed events to the master artists table
 * Extracts unique artists from events and syncs them to the artists table
 */
const syncArtistsToMasterTable = async (
  events: PartnerEvent[],
  source: "edmtrain" | "ticketmaster"
): Promise<void> => {
  try {
    // Extract unique artists from all events with their external IDs
    const artistsMap = new Map<string, { external_id: string; name: string }>();

    events.forEach((event) => {
      event.artistlist?.forEach((artist) => {
        if (artist?.id && artist?.name) {
          // Create external_id in the format "source:id"
          const externalId = `${source}:${artist.id}`;
          if (!artistsMap.has(externalId)) {
            artistsMap.set(externalId, {
              external_id: externalId,
              name: artist.name,
            });
          }
        }
      });
    });

    const uniqueArtists = Array.from(artistsMap.values());

    if (uniqueArtists.length === 0) {
      logger.info(`No artists to sync for ${source} events`);
      return;
    }

    // Sync artists to master table
    const syncResult = await artistService.syncArtistsFromEvents(
      uniqueArtists,
      source
    );

    logger.info(`Artist sync result for ${source}:`, syncResult);
  } catch (error) {
    logger.error(`Failed to sync artists for ${source}:`, error);
    // Don't throw - artist sync failure shouldn't break the entire job
  }
};

const assignGenresToEvents = async (
  events: PartnerEvent[],
  source: "edmtrain" | "ticketmaster"
): Promise<void> => {
  if (source === "edmtrain") {
    await assignGenresToEdmTrainEvents(events);
  } else if (source === "ticketmaster") {
    await assignGenresToTicketmasterEvents(events);
  }
};

/**
 * Assign genres to EDM Train events based on electronicgenreind flag.
 * Uses batch operations for optimal performance.
 *
 * Database Operations:
 * 1. Fetch both genres (Dance/Electronic + Pop) in ONE query
 * 2. Build all mappings in memory
 * 3. Batch upsert all event-genre mappings in ONE query
 *
 * Performance: 2 queries for N events (vs N queries in sequential)
 */
const assignGenresToEdmTrainEvents = async (
  events: PartnerEvent[]
): Promise<void> => {
  if (events.length === 0) return;

  try {
    const { data: genres, error: fetchError } = await supabase
      .from("prtnr_genres")
      .select("id, normalized_name")
      .in("normalized_name", ["dance-electronic", "pop"]);

    if (fetchError) {
      logger.error("Failed to fetch EDM genres", {
        error: fetchError.message,
        code: fetchError.code,
      });
      throw fetchError;
    }

    const electronicGenre = genres?.find(
      (g) => g.normalized_name === "dance-electronic"
    );
    const popGenre = genres?.find((g) => g.normalized_name === "pop");

    if (!electronicGenre || !popGenre) {
      // Genres not found - skip assignment (Ticketmaster will create them)
      logger.info(
        "EDM Train genres not found yet, skipping assignment (will be created by Ticketmaster)"
      );
      return;
    }

    const eventGenreMappings = events.map((event) => {
      const genreId = event.electronicgenreind
        ? electronicGenre.id
        : popGenre.id;

      return {
        event_id: event.id,
        genre_id: genreId,
        classification_primary: true,
        ticketmaster_classification_json: {
          source: "edmtrain",
          auto_assigned: true,
          electronicgenreind: event.electronicgenreind,
        },
      };
    });

    const { error: assignError } = await supabase
      .from("prtnr_event_genres")
      .upsert(eventGenreMappings, { onConflict: "event_id,genre_id" });

    if (assignError) {
      logger.error("Failed to assign EDM Train genres in batch", {
        error: assignError.message,
        code: assignError.code,
        count: eventGenreMappings.length,
      });
      throw assignError;
    }

    logger.info(
      `Assigned genres to ${eventGenreMappings.length} EDM Train events`
    );
  } catch (error) {
    logger.error("Failed to assign genres to EDM Train events", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * Assign genres to Ticketmaster events using classification data from API.
 * Uses batch operations for optimal performance.
 *
 * Database Operations:
 * 1. Extract unique genres from all events (in-memory)
 * 2. Fetch ALL existing genres in ONE query
 * 3. Batch create missing genres in ONE insert (if any)
 * 4. Build all event-genre mappings (in-memory)
 * 5. Batch upsert all mappings in ONE query
 *
 * Performance: 2-3 queries for N events (vs 2N-3N in sequential)
 */
const assignGenresToTicketmasterEvents = async (
  events: PartnerEvent[]
): Promise<void> => {
  if (events.length === 0) return;

  try {
    const genreMap = new Map<
      string,
      {
        name: string;
        normalizedName: string;
        ticketmasterGenreId: string;
        ticketmasterSegmentId?: string;
        segmentName?: string;
      }
    >();

    events.forEach((event) => {
      if (!event.classifications || event.classifications.length === 0) {
        return;
      }

      const primaryClassification =
        event.classifications.find((c) => c.primary === true) ||
        event.classifications[0];

      if (!primaryClassification?.genre?.name) return;

      const normalizedName = primaryClassification.genre.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      if (!genreMap.has(normalizedName)) {
        genreMap.set(normalizedName, {
          name: primaryClassification.genre.name,
          normalizedName,
          ticketmasterGenreId: primaryClassification.genre.id,
          ticketmasterSegmentId: primaryClassification.segment?.id,
          segmentName: primaryClassification.segment?.name,
        });
      }
    });

    if (genreMap.size === 0) {
      logger.warn("No genres to process from Ticketmaster events");
      return;
    }

    const { data: existingGenres, error: fetchError } = await supabase
      .from("prtnr_genres")
      .select("id, normalized_name, ticketmaster_genre_id")
      .in("normalized_name", Array.from(genreMap.keys()));

    if (fetchError) {
      logger.error("Failed to fetch existing genres", fetchError);
      throw fetchError;
    }

    const genreLookup = new Map<string, string>();
    (existingGenres || []).forEach((genre) => {
      genreLookup.set(genre.normalized_name, genre.id);
    });

    const missingGenres = Array.from(genreMap.entries())
      .filter(([normalizedName]) => !genreLookup.has(normalizedName))
      .map(([, genreData]) => ({
        name: genreData.name,
        normalized_name: genreData.normalizedName,
        ticketmaster_genre_id: genreData.ticketmasterGenreId,
        ticketmaster_segment_id: genreData.ticketmasterSegmentId,
        metadata: {
          segment_name: genreData.segmentName,
          created_from: "automatic_assignment",
        },
      }));

    if (missingGenres.length > 0) {
      const { data: createdGenres, error: createError } = await supabase
        .from("prtnr_genres")
        .insert(missingGenres)
        .select("id, normalized_name");

      if (createError) {
        logger.error("Failed to create genres in batch", {
          error: createError.message,
          code: createError.code,
          count: missingGenres.length,
        });
        throw createError;
      }

      (createdGenres || []).forEach((genre) => {
        genreLookup.set(genre.normalized_name, genre.id);
      });
    }

    const eventGenreMappings: Array<{
      event_id: number;
      genre_id: string;
      classification_primary: boolean;
      ticketmaster_classification_json: unknown;
    }> = [];

    events.forEach((event) => {
      if (!event.classifications || event.classifications.length === 0) {
        return;
      }

      const primaryClassification =
        event.classifications.find((c) => c.primary === true) ||
        event.classifications[0];

      if (!primaryClassification?.genre?.name) return;

      const normalizedName = primaryClassification.genre.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const genreId = genreLookup.get(normalizedName);
      if (!genreId) return;

      eventGenreMappings.push({
        event_id: event.id,
        genre_id: genreId,
        classification_primary: primaryClassification.primary || false,
        ticketmaster_classification_json: primaryClassification,
      });
    });

    if (eventGenreMappings.length > 0) {
      const { error: assignError } = await supabase
        .from("prtnr_event_genres")
        .upsert(eventGenreMappings, { onConflict: "event_id,genre_id" });

      if (assignError) {
        logger.error("Failed to assign genres in batch", {
          error: assignError.message,
          code: assignError.code,
          count: eventGenreMappings.length,
        });
        throw assignError;
      }

      logger.info(
        `Assigned genres to ${eventGenreMappings.length} Ticketmaster events (${missingGenres.length} new genres created)`
      );
    }
  } catch (error) {
    logger.error("Failed to assign genres to Ticketmaster events", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
