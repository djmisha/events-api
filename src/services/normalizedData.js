/**
 * Normalized Data Service
 * Handles upsert operations for venues, artists, and events with proper relationships
 * 
 * New Schema Tables:
 * - venues (venue records)
 * - artists (artist records)
 * - events_v2 (normalized events)
 * - event_artists (join table)
 */

const supabase = require("./supabaseClient");
const logger = require("./logger");

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
      const { data, error } = await supabase
        .from("venues")
        .upsert(venue, {
          onConflict: "external_id",
        })
        .select("id")
        .single();

      if (error) throw error;
      return data.id;
    } else {
      // Try to find existing venue by name and city
      const { data: existing, error: findError } = await supabase
        .from("venues")
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
        .from("venues")
        .insert(venue)
        .select("id")
        .single();

      if (error) throw error;
      return data.id;
    }
  } catch (error) {
    logger.error("Error upserting venue:", {
      error: error.message,
      venue: venue.name,
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
        const { data, error } = await supabase
          .from("artists")
          .upsert(artist, {
            onConflict: "external_id",
          })
          .select("id")
          .single();

        if (error) throw error;
        artistIds.push(data.id);
      } else {
        // Try to find existing artist by name
        const { data: existing, error: findError } = await supabase
          .from("artists")
          .select("id")
          .eq("name", artist.name)
          .maybeSingle();

        if (findError) throw findError;

        if (existing) {
          artistIds.push(existing.id);
        } else {
          // Insert new artist
          const { data, error } = await supabase
            .from("artists")
            .insert(artist)
            .select("id")
            .single();

          if (error) throw error;
          artistIds.push(data.id);
        }
      }
    } catch (error) {
      logger.error("Error upserting artist:", {
        error: error.message,
        artist: artist.name,
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

  const mappings = artistIds.map((artistId, index) => ({
    event_id: eventId,
    artist_id: artistId,
    display_order: index,
  }));

  try {
    // First, delete existing mappings for this event to handle removed artists
    const { error: deleteError } = await supabase
      .from("event_artists")
      .delete()
      .eq("event_id", eventId);

    if (deleteError) {
      logger.error(`Error deleting old artist mappings for event ${eventId}:`, deleteError);
    }

    // Insert new mappings
    const { error } = await supabase
      .from("event_artists")
      .insert(mappings);

    if (error) {
      logger.error(`Error inserting artist mappings for event ${eventId}:`, error);
    }
  } catch (error) {
    logger.error("Error managing event-artist mappings:", error);
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
        .from("events_v2")
        .upsert(eventData, {
          onConflict: "id",
        });

      if (eventError) {
        logger.error(`Error upserting event ${event.id}:`, eventError);
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
      .from("events_v2")
      .select(`
        *,
        venue:venues(*)
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
      .from("event_artists")
      .select(`
        event_id,
        display_order,
        artist:artists(*)
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
