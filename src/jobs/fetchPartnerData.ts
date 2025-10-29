import edmTrainService from "../services/edmTrain";
import ticketmasterService from "../services/ticketmaster";
import supabase from "../services/supabaseClient";
import cacheControl from "../services/cacheControl";
import transform from "../utils/transform";
import logger from "../services/logger";
import { PartnerEvent } from "../types";

export const execute = async (
  cityId: number,
  cityName: string
): Promise<void> => {
  logger.info(`Starting data fetch for ${cityName} (ID: ${cityId})`);

  try {
    const results = await Promise.allSettled([
      edmTrainService.fetchEvents(cityId, cityName),
      ticketmasterService.fetchEvents(cityId, cityName),
    ]);

    // Process each source independently and serially
    await processSourceUpdate(results[0], "edmtrain", cityId, cityName);
    await processSourceUpdate(results[1], "ticketmaster", cityId, cityName);

    await cacheControl.updateCacheTimestamp(cityId.toString());
    logger.info(`Completed data fetch for ${cityName} (ID: ${cityId})`);
  } catch (error) {
    logger.error(`Data fetch failed for ${cityName} (ID: ${cityId}):`, error);
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

  // Delete existing events for this source and location
  const { error: deleteError } = await supabase
    .from("partner_events")
    .delete()
    .eq("source", source)
    .eq("location_id", cityId);

  if (deleteError) {
    logger.error(`Failed to delete existing ${source} events:`, deleteError);
    throw deleteError;
  }

  // Insert new events in batches
  const batchSize = 100;
  let successCount = 0;

  for (let i = 0; i < transformedEvents.length; i += batchSize) {
    const batch = transformedEvents.slice(i, i + batchSize);

    const { error: insertError } = await supabase
      .from("partner_events")
      .insert(batch);

    if (insertError) {
      logger.error(`Failed to insert ${source} events batch:`, insertError);
      throw insertError;
    }

    successCount += batch.length;
  }

  logger.info(
    `Successfully updated ${successCount} ${source} events for ${cityName} (ID: ${cityId})`
  );

  // Assign genres to events
  await assignGenresToEvents(transformedEvents, source);
};

/**
 * Assign genres to events based on source and event properties
 */
const assignGenresToEvents = async (
  events: PartnerEvent[],
  source: "edmtrain" | "ticketmaster"
): Promise<void> => {
  if (source === "edmtrain") {
    // For EDM Train events, assign genre based on electronicgenreind flag
    await assignGenresToEdmTrainEvents(events);
  } else if (source === "ticketmaster") {
    // For Ticketmaster events, use classifications from API
    await assignGenresToTicketmasterEvents();
  }
};

/**
 * Assign genres to EDM Train events based on electronicgenreind flag from EDM Train API
 * - If electronicgenreind is true: assign "Dance/Electronic" genre
 * - If electronicgenreind is false: assign "Pop" genre
 */
/* eslint-disable no-restricted-syntax, no-continue */
const assignGenresToEdmTrainEvents = async (
  events: PartnerEvent[]
): Promise<void> => {
  try {
    // Find the Dance/Electronic genre by normalized name
    const { data: electronicGenre } = await supabase
      .from("prtnr_genres")
      .select("id")
      .eq("normalized_name", "dance-electronic")
      .maybeSingle();

    // Find Pop genre for non-electronic events
    const { data: popGenre } = await supabase
      .from("prtnr_genres")
      .select("id")
      .eq("normalized_name", "pop")
      .maybeSingle();

    if (!electronicGenre || !popGenre) {
      logger.warn(
        "Required genres not found. Run 'npm run genres:bootstrap' to import genres."
      );
      return;
    }

    let assignedCount = 0;
    let skippedCount = 0;

    for (const event of events) {
      try {
        // Use the electronicgenreind flag from EDM Train API to determine genre
        const genreId = event.electronicgenreind
          ? electronicGenre.id // Electronic music → Dance/Electronic
          : popGenre.id; // Non-electronic music → Pop

        // Log non-electronic events for visibility
        if (!event.electronicgenreind) {
          logger.info(
            `EDM Train event "${event.name}" (ID: ${event.id}) is flagged as non-electronic, assigning Pop genre`
          );
        }

        // Assign genre to event
        const { error: assignError } = await supabase
          .from("prtnr_event_genres")
          .upsert(
            {
              event_id: event.id,
              genre_id: genreId,
              classification_primary: true,
              ticketmaster_classification_json: {
                source: "edmtrain",
                auto_assigned: true,
                electronicgenreind: event.electronicgenreind,
              },
            },
            {
              onConflict: "event_id,genre_id",
            }
          );

        if (assignError) {
          logger.error(
            `Failed to assign genre to EDM Train event ${event.id}:`,
            assignError
          );
          skippedCount += 1;
        } else {
          assignedCount += 1;
        }
      } catch (err) {
        logger.error(
          `Error assigning genre to EDM Train event ${event.id}:`,
          err
        );
        skippedCount += 1;
      }
    }

    logger.info(
      `EDM Train genre assignment complete: ${assignedCount} assigned, ${skippedCount} skipped`
    );
  } catch (error) {
    logger.error("Failed to assign genres to EDM Train events:", error);
  }
};
/* eslint-enable no-restricted-syntax, no-continue */

/**
 * Assign genres to Ticketmaster events using their classification data
 */
const assignGenresToTicketmasterEvents = async (): Promise<void> => {
  // This would need the full event data with classifications
  // For now, we'll skip this as it requires fetching the full event data
  // The backfill job can handle this for existing events
  logger.info(
    "Ticketmaster events will get genres assigned during backfill or via classifications"
  );
};
