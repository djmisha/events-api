const edmTrainService = require("../services/edmTrain");
const ticketmasterService = require("../services/ticketmaster");
const supabase = require("../services/supabaseClient");
const cacheControl = require("../services/cacheControl");
const transform = require("../utils/transform");
const logger = require("../services/logger");

const execute = async (cityId, cityName) => {
  logger.info(`Fetching data for city: ${cityName} (ID: ${cityId})`);

  try {
    // Fetch from both sources in parallel
    const [edmTrainEvents, ticketmasterEvents] = await Promise.allSettled([
      edmTrainService.fetchEvents(cityId, cityName),
      ticketmasterService.fetchEvents(cityName),
    ]);

    const allEvents = [];

    // Process EDM Train results
    if (edmTrainEvents.status === "fulfilled" && edmTrainEvents.value) {
      const transformedEvents = transform.normalizeEdmTrainEvents(
        edmTrainEvents.value,
        cityId,
        cityName
      );
      allEvents.push(...transformedEvents);
      logger.info(
        `Fetched ${transformedEvents.length} events from EDM Train for city: ${cityName} (ID: ${cityId})`
      );
    } else {
      logger.warn(
        `EDM Train fetch failed for city: ${cityName} (ID: ${cityId})`,
        edmTrainEvents.reason
      );
    }

    // Process Ticketmaster results
    if (ticketmasterEvents.status === "fulfilled" && ticketmasterEvents.value) {
      const transformedEvents = transform.normalizeTicketmasterEvents(
        ticketmasterEvents.value,
        cityId,
        cityName
      );
      allEvents.push(...transformedEvents);
      logger.info(
        `Fetched ${transformedEvents.length} events from Ticketmaster for city: ${cityName} (ID: ${cityId})`
      );
    } else {
      logger.warn(
        `Ticketmaster fetch failed for city: ${cityName} (ID: ${cityId})`,
        ticketmasterEvents.reason
      );
    }

    if (allEvents.length === 0) {
      logger.info(`No events found for city: ${cityName} (ID: ${cityId})`);
      // Still update cache control to prevent repeated fetches
      await cacheControl.updateCacheTimestamp(cityId.toString());
      return;
    }

    // Save to Supabase
    logger.info(
      `Attempting to save ${allEvents.length} events to database for city: ${cityName} (ID: ${cityId})`
    );

    const { data, error: upsertError } = await supabase
      .from("partner_events")
      .upsert(allEvents, { onConflict: "id" })
      .select();

    if (upsertError) {
      logger.error(
        `Failed to save events to database for city: ${cityName} (ID: ${cityId})`
      );
      logger.error(`Supabase Error Details:`, {
        message: upsertError.message,
        details: upsertError.details,
        hint: upsertError.hint,
        code: upsertError.code,
      });
      logger.error(`Event Data Debug:`, {
        eventsCount: allEvents.length,
        sampleEventKeys: Object.keys(allEvents[0] || {}),
        firstEventId: allEvents[0]?.id,
        firstEventStructure: JSON.stringify(allEvents[0], null, 2),
      });
      console.error(
        "Full Supabase Error Object:",
        JSON.stringify(upsertError, null, 2)
      );
      throw upsertError;
    }

    logger.info(
      `Successfully saved ${
        data?.length || 0
      } events to database for city: ${cityName} (ID: ${cityId})`
    );

    // Update cache control timestamp after successful database save
    await cacheControl.updateCacheTimestamp(cityId.toString());

    logger.info(
      `Successfully processed ${allEvents.length} events for city: ${cityName} (ID: ${cityId})`
    );
  } catch (error) {
    logger.error(
      `Data fetch job failed for city: ${cityName} (ID: ${cityId})`,
      error
    );
    throw error;
  }
};

module.exports = {
  execute,
};
