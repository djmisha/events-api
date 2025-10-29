const edmTrainService = require("../services/edmTrain");
const ticketmasterService = require("../services/ticketmaster");
const cacheControl = require("../services/cacheControl");
const transform = require("../utils/transform");
const logger = require("../services/logger");
const normalizedDataBatch = require("../services/normalizedDataBatch");

const execute = async (cityId, cityName) => {
  logger.info(`Starting data fetch for ${cityName} (ID: ${cityId})`);

  try {
    const results = await Promise.allSettled([
      edmTrainService.fetchEvents(cityId, cityName),
      ticketmasterService.fetchEvents(cityName),
    ]);

    await processSourceUpdate(results[0], "edmtrain", cityId, cityName);
    await processSourceUpdate(results[1], "ticketmaster", cityId, cityName);

    await cacheControl.updateCacheTimestamp(cityId.toString());
    logger.info(`Completed data fetch for ${cityName} (ID: ${cityId})`);
  } catch (error) {
    logger.error({ 
      msg: `Data fetch failed for ${cityName}`, 
      cityId, 
      error: error.message 
    });
    throw error;
  }
};

const processSourceUpdate = async (result, source, cityId, cityName) => {
  if (result.status === "rejected") {
    logger.error({
      msg: `${source} API failed for ${cityName}`,
      cityId,
      error: result.reason?.message || result.reason,
    });
    return;
  }

  const events = result.value;
  if (!events || events.length === 0) {
    logger.info(`No ${source} events found for ${cityName}`);
    return;
  }

  logger.info(`Processing ${events.length} ${source} events for ${cityName}`);

  let transformedEvents;
  if (source === "edmtrain") {
    transformedEvents = transform.normalizeEdmTrainEvents(events, cityId, cityName);
  } else if (source === "ticketmaster") {
    transformedEvents = transform.normalizeTicketmasterEvents(events, cityId, cityName);
  } else {
    logger.error(`Unknown source: ${source}`);
    return;
  }

  const uniqueEvents = [];
  const seenIds = new Set();
  transformedEvents.forEach((event) => {
    if (!seenIds.has(event.id)) {
      seenIds.add(event.id);
      uniqueEvents.push(event);
    }
  });

  if (uniqueEvents.length < transformedEvents.length) {
    logger.warn({
      msg: `Removed duplicate ${source} events`,
      city: cityName,
      duplicates: transformedEvents.length - uniqueEvents.length,
    });
  }

  try {
    const result = await normalizedDataBatch.upsertEventsWithRelations(uniqueEvents, source);

    logger.info({
      msg: `Upserted ${source} events for ${cityName}`,
      success: result.success,
      failed: result.failed,
    });

    if (result.failed > 0) {
      logger.warn(`${result.failed} ${source} events failed to upsert for ${cityName}`);
    }
  } catch (error) {
    logger.error({
      msg: `Failed to update ${source} events`,
      city: cityName,
      error: error.message,
    });
    throw error;
  }
};

module.exports = {
  execute,
};
