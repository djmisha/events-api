/**
 * Backfill Script - Migrate existing partner_events data to normalized schema
 * 
 * This script:
 * 1. Extracts venues from partner_events.venue JSONB
 * 2. Extracts artists from partner_events.artistlist JSONB
 * 3. Populates partner_venues, partner_artists tables
 * 4. Updates partner_events.venue_id
 * 5. Populates partner_event_artists join table
 * 
 * Usage: node src/database/backfill.js
 */

require("dotenv").config();
const supabase = require("../services/supabaseClient");
const logger = require("../services/logger");

// Batch size for processing events
const BATCH_SIZE = 100;

/**
 * Generate a consistent external_id from source and original ID
 */
function generateExternalId(source, originalId) {
  if (!originalId) return null;
  return `${source}:${originalId}`;
}

/**
 * Upsert a venue and return its UUID
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
    // Use external_id for upsert if available, otherwise match on name+city
    if (externalId) {
      const { data, error } = await supabase
        .from("partner_venues")
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
        .from("partner_venues")
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
        .from("partner_venues")
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
    throw error;
  }
}

/**
 * Upsert an artist and return its UUID
 */
async function upsertArtist(artistData, source) {
  if (!artistData || !artistData.name) {
    return null;
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
        .from("partner_artists")
        .upsert(artist, {
          onConflict: "external_id",
        })
        .select("id")
        .single();

      if (error) throw error;
      return data.id;
    } else {
      // Try to find existing artist by name
      const { data: existing, error: findError } = await supabase
        .from("partner_artists")
        .select("id")
        .eq("name", artist.name)
        .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        return existing.id;
      }

      // Insert new artist
      const { data, error } = await supabase
        .from("partner_artists")
        .insert(artist)
        .select("id")
        .single();

      if (error) throw error;
      return data.id;
    }
  } catch (error) {
    logger.error("Error upserting artist:", {
      error: error.message,
      artist: artist.name,
    });
    throw error;
  }
}

/**
 * Process a single event and migrate its venue and artists
 */
async function processEvent(event) {
  const eventId = event.id;
  const source = event.source || "unknown";
  
  try {
    // Process venue
    let venueId = null;
    if (event.venue) {
      venueId = await upsertVenue(event.venue, source);
    }

    // Update event with venue_id
    if (venueId) {
      const { error: updateError } = await supabase
        .from("partner_events")
        .update({ venue_id: venueId })
        .eq("id", eventId);

      if (updateError) {
        logger.error(`Error updating event ${eventId} with venue_id:`, updateError);
      }
    }

    // Process artists
    if (event.artistlist && Array.isArray(event.artistlist)) {
      const artistMappings = [];

      for (let i = 0; i < event.artistlist.length; i++) {
        const artistData = event.artistlist[i];
        const artistId = await upsertArtist(artistData, source);

        if (artistId) {
          artistMappings.push({
            event_id: eventId,
            artist_id: artistId,
            display_order: i,
          });
        }
      }

      // Insert artist mappings
      if (artistMappings.length > 0) {
        const { error: mappingError } = await supabase
          .from("partner_event_artists")
          .upsert(artistMappings, {
            onConflict: "event_id,artist_id",
            ignoreDuplicates: true,
          });

        if (mappingError) {
          logger.error(`Error inserting artist mappings for event ${eventId}:`, mappingError);
        }
      }
    }

    return {
      success: true,
      eventId,
      venueId,
      artistCount: event.artistlist?.length || 0,
    };
  } catch (error) {
    logger.error(`Error processing event ${eventId}:`, error);
    return {
      success: false,
      eventId,
      error: error.message,
    };
  }
}

/**
 * Main backfill function
 */
async function runBackfill() {
  logger.info("Starting backfill process...");

  try {
    // Get total count of events to process
    const { count, error: countError } = await supabase
      .from("partner_events")
      .select("*", { count: "exact", head: true });

    if (countError) {
      throw new Error(`Error getting event count: ${countError.message}`);
    }

    logger.info(`Total events to process: ${count}`);

    let processed = 0;
    let successful = 0;
    let failed = 0;
    let offset = 0;

    // Process events in batches
    while (offset < count) {
      logger.info(`Processing batch: ${offset + 1} to ${Math.min(offset + BATCH_SIZE, count)}`);

      const { data: events, error: fetchError } = await supabase
        .from("partner_events")
        .select("id, source, venue, artistlist")
        .range(offset, offset + BATCH_SIZE - 1);

      if (fetchError) {
        logger.error("Error fetching events batch:", fetchError);
        offset += BATCH_SIZE;
        continue;
      }

      // Process each event in the batch
      for (const event of events) {
        const result = await processEvent(event);
        processed++;

        if (result.success) {
          successful++;
        } else {
          failed++;
        }

        // Log progress every 10 events
        if (processed % 10 === 0) {
          logger.info(`Progress: ${processed}/${count} (${successful} successful, ${failed} failed)`);
        }
      }

      offset += BATCH_SIZE;
    }

    logger.info("Backfill complete!");
    logger.info(`Total processed: ${processed}`);
    logger.info(`Successful: ${successful}`);
    logger.info(`Failed: ${failed}`);

    // Validation statistics
    await printValidationStats();

  } catch (error) {
    logger.error("Backfill failed:", error);
    throw error;
  }
}

/**
 * Print validation statistics
 */
async function printValidationStats() {
  logger.info("\n=== Validation Statistics ===");

  // Count venues
  const { count: venueCount } = await supabase
    .from("partner_venues")
    .select("*", { count: "exact", head: true });
  logger.info(`Total venues created: ${venueCount}`);

  // Count artists
  const { count: artistCount } = await supabase
    .from("partner_artists")
    .select("*", { count: "exact", head: true });
  logger.info(`Total artists created: ${artistCount}`);

  // Count events with venue_id
  const { count: eventsWithVenue } = await supabase
    .from("partner_events")
    .select("*", { count: "exact", head: true })
    .not("venue_id", "is", null);
  logger.info(`Events with venue_id: ${eventsWithVenue}`);

  // Count artist mappings
  const { count: mappingCount } = await supabase
    .from("partner_event_artists")
    .select("*", { count: "exact", head: true });
  logger.info(`Total event-artist mappings: ${mappingCount}`);

  logger.info("============================\n");
}

// Run the backfill if executed directly
if (require.main === module) {
  runBackfill()
    .then(() => {
      logger.info("Backfill completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Backfill failed with error:", error);
      process.exit(1);
    });
}

module.exports = {
  runBackfill,
  upsertVenue,
  upsertArtist,
};
