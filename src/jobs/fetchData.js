const edmTrainService = require("../services/edmTrain");
const ticketmasterService = require("../services/ticketmaster");
const supabase = require("../services/supabaseClient");
const cacheControl = require("../services/cacheControl");
const transform = require("../utils/transform");
const logger = require("../services/logger");

const execute = async (cityId, cityName) => {
  logger.info(`Starting data fetch for ${cityName} (ID: ${cityId})`);

  try {
    const results = await Promise.allSettled([
      edmTrainService.fetchEvents(cityId, cityName),
      ticketmasterService.fetchEvents(cityName),
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

const processSourceUpdate = async (result, source, cityId, cityName) => {
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
  let transformedEvents;
  if (source === "edmtrain") {
    transformedEvents = transform.normalizeEdmTrainEvents(
      events,
      cityId,
      cityName
    );
  } else if (source === "ticketmaster") {
    transformedEvents = transform.normalizeTicketmasterEvents(
      events,
      cityId,
      cityName
    );
  } else {
    logger.error(`Unknown source: ${source}`);
    return;
  }

  // Remove duplicates within the source
  const idCounts = {};
  const duplicateIds = [];
  transformedEvents.forEach((event) => {
    if (idCounts[event.id]) {
      idCounts[event.id]++;
      if (idCounts[event.id] === 2) {
        duplicateIds.push(event.id);
      }
    } else {
      idCounts[event.id] = 1;
    }
  });

  if (duplicateIds.length > 0) {
    const uniqueEvents = [];
    const seenIds = new Set();
    transformedEvents.forEach((event) => {
      if (!seenIds.has(event.id)) {
        seenIds.add(event.id);
        uniqueEvents.push(event);
      }
    });
    transformedEvents = uniqueEvents;
    logger.warn(
      `Removed ${duplicateIds.length} duplicate ${source} events for ${cityName}`
    );
  }

  try {
    // Delete existing events from this source
    const { error: deleteError } = await supabase
      .from("partner_events")
      .delete()
      .eq("location_id", cityId)
      .eq("source", source);

    if (deleteError) {
      logger.error(
        `Failed to clear ${source} events for ${cityName}:`,
        deleteError
      );
      throw deleteError;
    }

    // Check for ID conflicts with other sources
    const eventIds = transformedEvents.map((e) => e.id);
    const { data: conflictingEvents } = await supabase
      .from("partner_events")
      .select("id, source, location_id")
      .in("id", eventIds);

    if (conflictingEvents && conflictingEvents.length > 0) {
      const conflictingIds = new Set(conflictingEvents.map((e) => e.id));
      const originalCount = transformedEvents.length;
      transformedEvents = transformedEvents.filter(
        (event) => !conflictingIds.has(event.id)
      );

      if (originalCount > transformedEvents.length) {
        logger.warn(
          `Removed ${
            originalCount - transformedEvents.length
          } conflicting ${source} events for ${cityName}`
        );
      }

      if (transformedEvents.length === 0) {
        logger.warn(
          `No ${source} events left after conflict resolution for ${cityName}`
        );
        return;
      }
    }

    // Insert new events
    const { data, error: insertError } = await supabase
      .from("partner_events")
      .insert(transformedEvents)
      .select();

    if (insertError) {
      logger.error(`Failed to insert ${source} events for ${cityName}:`, {
        message: insertError.message,
        code: insertError.code,
        eventsCount: transformedEvents.length,
      });
      throw insertError;
    }

    logger.info(
      `Updated ${data?.length || 0} ${source} events for ${cityName}`
    );
  } catch (error) {
    logger.error(`Failed to update ${source} events for ${cityName}:`, error);
    throw error;
  }
};

module.exports = {
  execute,
};
