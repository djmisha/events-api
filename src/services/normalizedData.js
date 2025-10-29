/**
 * Normalized Data Service
 * Handles upsert operations for venues, artists, and events with proper relationships
 * 
 * Schema Tables:
 * - prtnr_venues (venue records)
 * - prtnr_artists (artist records)
 * - prtnr_events (normalized events)
 * - prtnr_event_artists (join table)
 */

const supabase = require("./supabaseClient");
const logger = require("./logger");

/**
 * Retry helper for transient Supabase errors
 */
async function retryOperation(operation, maxRetries = 2, delayMs = 1000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isRetryable = error.message?.includes('500') || 
                          error.message?.includes('Internal server error') ||
                          error.message?.includes('Cloudflare');
      
      if (isRetryable && attempt < maxRetries) {
        logger.warn(`Retrying operation (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
}

/**
 * Generate a consistent external_id from source and original ID
 */
function generateExternalId(source, originalId) {
  if (!originalId) return null;
  return `${source}:${originalId}`;
}

/**
 * Upsert a venue and return its UUID
 * @param {Object} venueData - Venue data object
 * @param {string} source - Data source (edmtrain, ticketmaster)
 * @returns {Promise<string|null>} - Venue UUID
 */
async function upsertVenue(venueData, source) {
  if (!venueData || !venueData.name) {
    return null;
  }

  const externalId = venueData.id 
    ? generateExternalId(source, venueData.id) 
    : null;

  const venue = {
    external_id: externalId,
    name: venueData.name,
    city: venueData.city || venueData.location?.split(',')[0]?.trim() || null,
    state: venueData.state || null,
    country: venueData.country || null,
    address: venueData.address || null,
    latitude: venueData.latitude || null,
    longitude: venueData.longitude || null,
    metadata: venueData,
  };

  try {
    if (externalId) {
      // Check if venue exists by external_id
      const { data: existing, error: findError } = await supabase
        .from("prtnr_venues")
        .select("id")
        .eq("external_id", externalId)
        .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        // Update existing venue
        const { error: updateError } = await supabase
          .from("prtnr_venues")
          .update(venue)
          .eq("id", existing.id);

        if (updateError) throw updateError;
        return existing.id;
      }

      // Insert new venue
      const { data, error } = await supabase
        .from("prtnr_venues")
        .insert(venue)
        .select("id")
        .single();

      if (error) throw error;
      return data.id;
    } else {
      // Try to find existing venue by name and city
      const { data: existing, error: findError } = await supabase
        .from("prtnr_venues")
        .select("id")
        .eq("name", venue.name)
        .eq("city", venue.city)
        .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        return existing.id;
      }

      // Insert new venue
      const { data, error } = await supabase
        .from("prtnr_venues")
        .insert(venue)
        .select("id")
        .single();

      if (error) throw error;
      return data.id;
    }
  } catch (error) {
    logger.error({
      msg: "Error upserting venue",
      error: error.message || String(error),
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null,
      venue: venue.name,
      externalId,
      venueData: venue,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    return null;
  }
}

/**
 * Upsert multiple artists and return their UUIDs
 * @param {Array} artistList - Array of artist data objects
 * @param {string} source - Data source (edmtrain, ticketmaster)
 * @returns {Promise<Array>} - Array of artist UUIDs
 */
async function upsertArtists(artistList, source) {
  if (!Array.isArray(artistList) || artistList.length === 0) {
    return [];
  }

  const artistIds = [];

  for (const artistData of artistList) {
    if (!artistData || !artistData.name) {
      continue;
    }

    const externalId = artistData.id 
      ? generateExternalId(source, artistData.id) 
      : null;

    const artist = {
      external_id: externalId,
      name: artistData.name,
      metadata: artistData,
    };

    try {
      if (externalId) {
        // Check if artist exists by external_id with retry
        const result = await retryOperation(async () => {
          const { data: existing, error: findError } = await supabase
            .from("prtnr_artists")
            .select("id")
            .eq("external_id", externalId)
            .maybeSingle();

          if (findError) throw findError;
          return existing;
        });

        if (result) {
          // Update existing artist
          await retryOperation(async () => {
            const { error: updateError } = await supabase
              .from("prtnr_artists")
              .update(artist)
              .eq("id", result.id);

            if (updateError) throw updateError;
          });
          artistIds.push(result.id);
        } else {
          // Insert new artist
          const inserted = await retryOperation(async () => {
            const { data, error } = await supabase
              .from("prtnr_artists")
              .insert(artist)
              .select("id")
              .single();

            if (error) throw error;
            return data;
          });
          artistIds.push(inserted.id);
        }
      } else {
        // Try to find existing artist by name
        const { data: existing, error: findError } = await supabase
          .from("prtnr_artists")
          .select("id")
          .eq("name", artist.name)
          .maybeSingle();

        if (findError) throw findError;

        if (existing) {
          artistIds.push(existing.id);
        } else {
          // Insert new artist
          const { data, error } = await supabase
            .from("prtnr_artists")
            .insert(artist)
            .select("id")
            .single();

          if (error) throw error;
          artistIds.push(data.id);
        }
      }
    } catch (error) {
      logger.error({
        msg: "Error upserting artist",
        error: error.message || String(error),
        details: error.details || null,
        hint: error.hint || null,
        code: error.code || null,
        artist: artist.name,
        externalId,
        artistData: artist,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
    }
  }

  return artistIds;
}

/**
 * Upsert event-artist mappings
 * @param {number} eventId - Event ID
 * @param {Array} artistIds - Array of artist UUIDs
 */
async function upsertEventArtists(eventId, artistIds) {
  if (!artistIds || artistIds.length === 0) {
    return;
  }

  // Remove duplicate artist IDs while preserving order
  const uniqueArtistIds = [...new Set(artistIds)];

  const mappings = uniqueArtistIds.map((artistId, index) => ({
    event_id: eventId,
    artist_id: artistId,
    display_order: index,
  }));

  try {
    // First, delete existing mappings for this event to handle removed artists
    const { error: deleteError } = await supabase
      .from("prtnr_event_artists")
      .delete()
      .eq("event_id", eventId);

    if (deleteError) {
      logger.error({
        msg: `Error deleting old artist mappings for event ${eventId}`,
        error: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint,
        code: deleteError.code,
      });
      return; // Don't proceed if delete fails
    }

    // Insert new mappings
    const { error } = await supabase
      .from("prtnr_event_artists")
      .insert(mappings);

    if (error) {
      logger.error({
        msg: `Error inserting artist mappings for event ${eventId}`,
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        eventId,
        artistCount: uniqueArtistIds.length,
        mappings,
      });
    }
  } catch (error) {
    logger.error({
      msg: "Error managing event-artist mappings",
      error: error.message,
      stack: error.stack,
      eventId,
    });
  }
}

/**
 * Upsert a complete event with its venue and artists in a transactional manner
 * @param {Array} events - Array of event objects with venue and artistlist
 * @param {string} source - Data source
 */
async function upsertEventsWithRelations(events, source) {
  if (!Array.isArray(events) || events.length === 0) {
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  for (const event of events) {
    try {
      // 1. Upsert venue
      const venueId = await upsertVenue(event.venue, source);

      // 2. Upsert artists
      const artistIds = await upsertArtists(event.artistlist, source);

      // 3. Prepare event data with venue_id
      const eventData = {
        id: event.id,
        source: event.source,
        link: event.link,
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
        venue_id: venueId,
      };

      // 4. Upsert event
      const { error: eventError } = await supabase
        .from("prtnr_events")
        .upsert(eventData, {
          onConflict: "id",
        });

      if (eventError) {
        logger.error({
          msg: `Error upserting event ${event.id}`,
          error: eventError.message,
          details: eventError.details,
          hint: eventError.hint,
          code: eventError.code,
          eventData,
        });
        failed++;
        continue;
      }

      // 5. Upsert event-artist mappings
      await upsertEventArtists(event.id, artistIds);

      success++;
    } catch (error) {
      logger.error(`Failed to process event ${event.id}:`, error);
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Get events with their venue and artists for a location
 * @param {number} locationId - Location ID
 * @returns {Promise<Array>} - Events with venue and artists
 */
async function getEventsWithRelations(locationId) {
  try {
    // Fetch events with venue data
    const { data: events, error: eventsError } = await supabase
      .from("prtnr_events")
      .select(`
        *,
        venue:prtnr_venues(*)
      `)
      .eq("location_id", locationId)
      .order("date", { ascending: true });

    if (eventsError) {
      throw eventsError;
    }

    if (!events || events.length === 0) {
      return [];
    }

    // Fetch artist mappings for all events
    const eventIds = events.map(e => e.id);
    const { data: artistMappings, error: mappingsError } = await supabase
      .from("prtnr_event_artists")
      .select(`
        event_id,
        display_order,
        artist:prtnr_artists(*)
      `)
      .in("event_id", eventIds)
      .order("display_order", { ascending: true });

    if (mappingsError) {
      logger.error("Error fetching artist mappings:", mappingsError);
    }

    // Group artists by event
    const artistsByEvent = {};
    if (artistMappings) {
      artistMappings.forEach(mapping => {
        if (!artistsByEvent[mapping.event_id]) {
          artistsByEvent[mapping.event_id] = [];
        }
        artistsByEvent[mapping.event_id].push(mapping.artist);
      });
    }

    // Attach artists to events
    const eventsWithRelations = events.map(event => ({
      ...event,
      artists: artistsByEvent[event.id] || [],
    }));

    return eventsWithRelations;
  } catch (error) {
    logger.error("Error fetching events with relations:", error);
    throw error;
  }
}

module.exports = {
  upsertVenue,
  upsertArtists,
  upsertEventArtists,
  upsertEventsWithRelations,
  getEventsWithRelations,
  generateExternalId,
};
