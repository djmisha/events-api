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
};
