/**
 * Optimized Batch Normalized Data Service
 *
 * High-performance batch operations for serverless environments.
 * This service manages the normalized database schema with separate tables for:
 * - prtnr_events: Event records
 * - prtnr_venues: Venue records
 * - prtnr_artists: Artist records
 * - prtnr_event_artists: Many-to-many relationship between events and artists
 *
 * Key Features:
 * - Batch upsert operations to minimize database round trips
 * - Race condition handling for concurrent insertions
 * - External ID mapping to prevent duplicates across data sources
 * - Efficient relationship management with junction tables
 *
 * Performance Optimizations:
 * - Single batch insert per entity type (venues, artists, events)
 * - Reuses existing records by external_id to avoid duplicates
 * - Handles Postgres unique constraint violations gracefully
 * - Optimized for serverless with minimal memory footprint
 */

import supabase from "./supabaseClient";
import logger from "./logger";
import {
  NormalizedVenue,
  NormalizedArtist,
  NormalizedEvent,
  BatchUpsertResult,
} from "../types";

/**
 * Generate a unique external ID for entities from different sources
 *
 * External IDs follow the format: "source:originalId" (e.g., "edmtrain:12345")
 * This allows us to track entities across different data sources while preventing
 * duplicate records in our normalized tables.
 *
 * @param source - The data source (e.g., "edmtrain", "ticketmaster")
 * @param originalId - The original ID from the external source
 * @returns Formatted external ID string, or null if originalId is missing
 *
 * @example
 * generateExternalId("edmtrain", 12345) // Returns: "edmtrain:12345"
 * generateExternalId("ticketmaster", "vvG1zZpVVA") // Returns: "ticketmaster:vvG1zZpVVA"
 */
function generateExternalId(
  source: string,
  originalId: number | string
): string | null {
  if (!originalId) return null;
  return `${source}:${originalId}`;
}

/**
 * Batch upsert venues into the prtnr_venues table
 *
 * This function efficiently handles multiple venues in a single database operation:
 * 1. Generates external IDs for all venues
 * 2. Checks which venues already exist in the database
 * 3. Inserts only new venues (avoiding duplicates)
 * 4. Handles race conditions when multiple processes insert simultaneously
 * 5. Returns a mapping of external_id -> internal database ID
 *
 * Race Condition Handling:
 * If a unique constraint violation occurs (error code 23505), it means another
 * process inserted the same venue. We refetch all venues to get the complete mapping.
 *
 * @param venues - Array of venue objects from external sources
 * @param source - The data source identifier (e.g., "edmtrain", "ticketmaster")
 * @returns Map of external_id to internal database UUID for all venues
 *
 * @example
 * const venues = [{ id: 123, name: "The Venue", city: "Boston" }];
 * const venueMap = await batchUpsertVenues(venues, "edmtrain");
 * // venueMap.get("edmtrain:123") returns the UUID from prtnr_venues table
 */
async function batchUpsertVenues(
  venues: NormalizedVenue[],
  source: string
): Promise<Map<string, string>> {
  if (!venues || venues.length === 0) return new Map();

  // Transform venues into database format with external IDs
  const venueRecords = venues.map((v) => ({
    external_id: generateExternalId(source, v.id),
    name: v.name,
    // location: v.location || null, // Formatted location string (e.g., "Phoenix, AZ")
    city: v.city || v.location?.split(",")[0]?.trim() || null, // Parse city from location if not provided
    state: v.state || null,
    country: v.country || null,
    address: v.address || null,
    latitude: v.latitude || null,
    longitude: v.longitude || null,
    metadata: v, // Store original data for reference
  }));

  const externalIds = venueRecords.map((v) => v.external_id);

  // Fetch existing venues to avoid re-inserting duplicates
  const { data: existing } = await supabase
    .from("prtnr_venues")
    .select("id, external_id")
    .in("external_id", externalIds);

  // Build a map of external_id -> database UUID for existing venues
  const existingMap = new Map<string, string>();
  existing?.forEach((v) => existingMap.set(v.external_id, v.id));

  // Filter out venues that already exist in the database
  const newVenues = venueRecords.filter(
    (v) => !existingMap.has(v.external_id as string)
  );

  // Only insert venues that don't already exist
  if (newVenues.length > 0) {
    const { data: inserted, error } = await supabase
      .from("prtnr_venues")
      .insert(newVenues)
      .select("id, external_id");

    if (error && error.code === "23505") {
      // Race condition: Another process inserted the same venue(s)
      // Refetch all venues to get the complete mapping
      const { data: refetch } = await supabase
        .from("prtnr_venues")
        .select("id, external_id")
        .in("external_id", externalIds);
      refetch?.forEach((v) => existingMap.set(v.external_id, v.id));
      logger.warn(
        `Race condition detected inserting venues, refetched successfully`
      );
    } else if (error) {
      logger.error({
        msg: "Batch venue insert failed",
        error: error.message,
        code: error.code,
      });
    } else {
      // Success: Add newly inserted venues to the map
      inserted?.forEach((v) => existingMap.set(v.external_id, v.id));
    }
  }

  return existingMap;
}

/**
 * Batch upsert artists into the prtnr_artists table
 *
 * This function efficiently handles multiple artists in a single database operation:
 * 1. Generates external IDs for all artists
 * 2. Checks which artists already exist in the database
 * 3. Inserts only new artists (avoiding duplicates)
 * 4. Handles race conditions when multiple processes insert simultaneously
 * 5. Returns a mapping of external_id -> internal database ID
 *
 * The logic mirrors batchUpsertVenues but operates on the prtnr_artists table.
 * Artists are deduplicated by external_id to handle cases where the same artist
 * appears in multiple events or from multiple data sources.
 *
 * @param artists - Array of artist objects from external sources
 * @param source - The data source identifier (e.g., "edmtrain", "ticketmaster")
 * @returns Map of external_id to internal database UUID for all artists
 *
 * @example
 * const artists = [{ id: 456, name: "DJ Example", link: "https://..." }];
 * const artistMap = await batchUpsertArtists(artists, "edmtrain");
 * // artistMap.get("edmtrain:456") returns the UUID from prtnr_artists table
 */
async function batchUpsertArtists(
  artists: NormalizedArtist[],
  source: string
): Promise<Map<string, string>> {
  if (!artists || artists.length === 0) return new Map();

  // Transform artists into database format with external IDs
  const artistRecords = artists.map((a) => ({
    external_id: generateExternalId(source, a.id),
    name: a.name,
    metadata: a, // Store original data for reference
  }));

  const externalIds = artistRecords.map((a) => a.external_id);

  // Fetch existing artists to avoid re-inserting duplicates
  const { data: existing } = await supabase
    .from("prtnr_artists")
    .select("id, external_id")
    .in("external_id", externalIds);

  // Build a map of external_id -> database UUID for existing artists
  const existingMap = new Map<string, string>();
  existing?.forEach((a) => existingMap.set(a.external_id, a.id));

  // Filter out artists that already exist in the database
  const newArtists = artistRecords.filter(
    (a) => !existingMap.has(a.external_id as string)
  );

  // Only insert artists that don't already exist
  if (newArtists.length > 0) {
    const { data: inserted, error } = await supabase
      .from("prtnr_artists")
      .insert(newArtists)
      .select("id, external_id");

    if (error && error.code === "23505") {
      // Race condition: Another process inserted the same artist(s)
      // Refetch all artists to get the complete mapping
      const { data: refetch } = await supabase
        .from("prtnr_artists")
        .select("id, external_id")
        .in("external_id", externalIds);
      refetch?.forEach((a) => existingMap.set(a.external_id, a.id));
      logger.warn(
        `Race condition detected inserting artists, refetched successfully`
      );
    } else if (error) {
      logger.error({
        msg: "Batch artist insert failed",
        error: error.message,
        code: error.code,
      });
    } else {
      // Success: Add newly inserted artists to the map
      inserted?.forEach((a) => existingMap.set(a.external_id, a.id));
    }
  }

  return existingMap;
}

/**
 * Upsert events with their related venues and artists in a normalized database structure
 *
 * This is the main orchestration function that handles complex multi-table operations:
 *
 * Process Flow:
 * 1. Extract unique venues and artists from all events
 * 2. Batch upsert venues and get venue ID mappings
 * 3. Batch upsert artists and get artist ID mappings
 * 4. Upsert events with foreign keys to venues
 * 5. Delete old event-artist relationships
 * 6. Insert new event-artist relationships with display order
 *
 * Database Tables Updated:
 * - prtnr_venues: Venue records (deduplicated by external_id)
 * - prtnr_artists: Artist records (deduplicated by external_id)
 * - prtnr_events: Event records (upserted by id)
 * - prtnr_event_artists: Many-to-many junction table (recreated on each upsert)
 *
 * Performance Characteristics:
 * - Single batch operation per table (4 total queries in best case)
 * - Deduplicates venues/artists across multiple events
 * - Maintains artist display order per event
 * - Handles missing or null venue/artist data gracefully
 *
 * @param events - Array of event objects with nested venue and artist data
 * @param source - The data source identifier (e.g., "edmtrain", "ticketmaster")
 * @returns Object with success and failed counts for tracking
 *
 * @example
 * const events = [
 *   {
 *     id: 1,
 *     name: "Concert",
 *     venue: { id: 100, name: "The Venue" },
 *     artistlist: [{ id: 200, name: "Artist 1" }, { id: 201, name: "Artist 2" }]
 *   }
 * ];
 * const result = await upsertEventsWithRelations(events, "edmtrain");
 * console.log(`${result.success} events processed`);
 */
async function upsertEventsWithRelations(
  events: NormalizedEvent[],
  source: string
): Promise<BatchUpsertResult> {
  if (!Array.isArray(events) || events.length === 0) {
    return { success: 0, failed: events.length };
  }

  // Step 1: Extract and deduplicate venues and artists across all events
  // This prevents inserting the same venue/artist multiple times
  const uniqueVenues = new Map<string, NormalizedVenue>();
  const uniqueArtists = new Map<string, NormalizedArtist>();

  events.forEach((event) => {
    // Collect unique venues
    if (event.venue?.id) {
      const venueKey = generateExternalId(source, event.venue.id);
      if (venueKey && !uniqueVenues.has(venueKey)) {
        uniqueVenues.set(venueKey, event.venue);
      }
    }

    // Collect unique artists from all events
    event.artistlist?.forEach((artist) => {
      if (artist?.id) {
        const artistKey = generateExternalId(source, artist.id);
        if (artistKey && !uniqueArtists.has(artistKey)) {
          uniqueArtists.set(artistKey, artist);
        }
      }
    });
  });

  // Step 2: Batch upsert all unique venues and artists
  // These operations return Maps of external_id -> internal UUID
  const venueIdMap = await batchUpsertVenues(
    Array.from(uniqueVenues.values()),
    source
  );
  const artistIdMap = await batchUpsertArtists(
    Array.from(uniqueArtists.values()),
    source
  );

  // Step 3: Prepare event records and artist relationships
  const eventDataList: any[] = [];
  const eventArtistMappings: any[] = [];

  events.forEach((event) => {
    // Look up the internal venue UUID from our venue ID map
    const venueKey = event.venue?.id
      ? generateExternalId(source, event.venue.id)
      : null;
    const venueId = venueKey ? venueIdMap.get(venueKey) : null;

    // Build event record with foreign key to venue
    eventDataList.push({
      id: event.id,
      source: event.source,
      link: event.link,
      image: event.image,
      name: event.name,
      ages: event.ages,
      festivalind: event.festivalind,
      livestreamind: event.livestreamind,
      electronicgenreind: event.electronicgenreind,
      othergenreind: event.othergenreind,
      date: event.date,
      starttime: event.starttime,
      endtime: event.endtime,
      createddate: event.createddate,
      location_id: event.location_id,
      venue_id: venueId, // Foreign key to prtnr_venues
    });

    // Build event-artist relationships with display order
    // display_order preserves the order artists appear in the source data
    const seenArtists = new Set<string>();
    event.artistlist?.forEach((artist) => {
      if (artist?.id) {
        const artistKey = generateExternalId(source, artist.id);
        const artistId = artistKey ? artistIdMap.get(artistKey) : null;
        // Deduplicate artists per event (in case source data has duplicates)
        if (artistId && !seenArtists.has(artistId)) {
          seenArtists.add(artistId);
          eventArtistMappings.push({
            event_id: event.id,
            artist_id: artistId,
            display_order: seenArtists.size - 1, // 0-indexed order
          });
        }
      }
    });
  });

  // Step 4: Upsert all events in a single batch operation
  // Using onConflict: "id" means we update existing events with the same ID
  const { error: eventsError } = await supabase
    .from("prtnr_events")
    .upsert(eventDataList, { onConflict: "id" });

  if (eventsError) {
    logger.error({
      msg: "Batch event upsert failed",
      error: eventsError.message,
      code: eventsError.code,
      count: eventDataList.length,
    });
    return { success: 0, failed: events.length };
  }

  // Step 5: Delete old event-artist relationships
  // We recreate these relationships on each upsert to handle artist list changes
  const eventIds = events.map((e) => e.id);
  await supabase.from("prtnr_event_artists").delete().in("event_id", eventIds);

  // Step 6: Insert new event-artist relationships
  if (eventArtistMappings.length > 0) {
    const { error: mappingsError } = await supabase
      .from("prtnr_event_artists")
      .insert(eventArtistMappings);

    if (mappingsError) {
      logger.error({
        msg: "Batch artist mapping insert failed",
        error: mappingsError.message,
        code: mappingsError.code,
        count: eventArtistMappings.length,
      });
    }
  }

  return { success: events.length, failed: 0 };
}

/**
 * Retrieve events with their related venues and artists for a specific location
 *
 * This function fetches denormalized event data by joining across multiple tables:
 * - prtnr_events: Base event data
 * - prtnr_venues: Venue details (joined via venue_id foreign key)
 * - prtnr_event_artists: Event-artist relationships (joined via event_id)
 * - prtnr_artists: Artist details (joined via artist_id)
 *
 * Query Strategy:
 * 1. Fetch events with venues in one query using Supabase's relation syntax
 * 2. Fetch all artist mappings for these events in a second query
 * 3. Group artists by event_id in memory
 * 4. Combine data into final denormalized structure
 *
 * This two-query approach is more efficient than N+1 queries per event.
 *
 * Data Structure Returned:
 * Each event includes:
 * - All event fields from prtnr_events table
 * - venue: Full venue object with all venue fields
 * - artists: Array of artist objects ordered by display_order
 *
 * @param locationId - The location ID to filter events by
 * @returns Array of events with nested venue and artists data, ordered by date
 *
 * @example
 * const events = await getEventsWithRelations(17); // Boston events
 * events.forEach(event => {
 *   console.log(`${event.name} at ${event.venue.name}`);
 *   event.artists.forEach(artist => console.log(`  - ${artist.name}`));
 * });
 */
async function getEventsWithRelations(locationId: number): Promise<any[]> {
  try {
    // Step 1: Fetch events with venues using Supabase's relation syntax
    // The asterisk (*) selects all fields from the related venue table
    const { data: events, error: eventsError } = await supabase
      .from("prtnr_events")
      .select("*, venue:prtnr_venues(*)")
      .eq("location_id", locationId)
      .order("date", { ascending: true });

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) return [];

    // Step 2: Fetch all artist mappings for these events in a single query
    const eventIds = events.map((e) => e.id);
    const { data: artistMappings, error: mappingsError } = await supabase
      .from("prtnr_event_artists")
      .select("event_id, display_order, artist:prtnr_artists(*)")
      .in("event_id", eventIds)
      .order("display_order", { ascending: true });

    if (mappingsError) {
      logger.error({
        msg: "Failed to fetch artist mappings",
        error: mappingsError.message,
      });
    }

    // Step 3: Group artists by event_id for efficient lookup
    const artistsByEvent: Record<number, any[]> = {};
    artistMappings?.forEach((mapping) => {
      if (!artistsByEvent[mapping.event_id]) {
        artistsByEvent[mapping.event_id] = [];
      }
      artistsByEvent[mapping.event_id].push(mapping.artist);
    });

    // Step 4: Combine events with their artists
    // Artists are already sorted by display_order from the query
    return events.map((event) => ({
      ...event,
      artists: artistsByEvent[event.id] || [],
    }));
  } catch (error: any) {
    logger.error({
      msg: "Failed to fetch events with relations",
      error: error.message,
    });
    throw error;
  }
}

export {
  upsertEventsWithRelations,
  getEventsWithRelations,
  generateExternalId,
};
