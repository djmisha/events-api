const express = require("express");
const logger = require("../services/logger");
const cacheControl = require("../services/cacheControl");
const backgroundJobs = require("../services/backgroundJobs");
const normalizedDataBatch = require("../services/normalizedDataBatch");

const router = express.Router();

router.get("/:id/:city", async (req, res) => {
  try {
    const { id, city } = req.params;

    if (!id || !city) {
      return res.status(400).json({
        error: "Missing required parameters: id and city",
        message: "Please provide both ID and city in the URL path",
        example: "/api/v1/events/123/chicago",
      });
    }

    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return res.status(400).json({
        error: "Invalid ID parameter",
        message: "ID must be a numeric value",
        provided: id,
      });
    }

    logger.info(`Events request: ${city} (ID: ${numericId})`);

    let events;
    try {
      events = await normalizedDataBatch.getEventsWithRelations(numericId);
    } catch (error) {
      logger.error({
        msg: `Database query error for ${city}`,
        cityId: numericId,
        error: error.message,
        code: error.code,
      });

      return res.status(500).json({
        error: "Database error",
        message: "Failed to fetch events from database",
      });
    }

    logger.info(`Found ${events?.length || 0} events for ${city}`);

    const needsUpdate = await cacheControl.checkNeedsUpdate(numericId.toString());

    if (needsUpdate) {
      logger.info(`Cache expired for ${city}, triggering background fetch`);

      setImmediate(() => {
        backgroundJobs
          .triggerBackgroundFetch(numericId, city)
          .catch((error) => {
            logger.error({ msg: `Background fetch failed for ${city}`, error: error.message });
          });
      });
    }

    return res.json({
      source: "database",
      id: numericId,
      city: city,
      cacheStatus: needsUpdate ? "updating" : "fresh",
      count: events?.length || 0,
      data: events || [],
    });
  } catch (error) {
    logger.error({
      msg: "Events endpoint error",
      error: error.message,
    });
    return res.status(500).json({
      error: "Internal server error",
      message: "An unexpected error occurred",
    });
  }
});

module.exports = router;
