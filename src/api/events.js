const express = require("express");
const supabase = require("../services/supabaseClient");
const logger = require("../services/logger");
const cacheControl = require("../services/cacheControl");
const backgroundJobs = require("../services/backgroundJobs");

const router = express.Router();

router.get("/:id/:city", async (req, res) => {
  try {
    const { id, city } = req.params;

    // Validate parameters
    if (!id || !city) {
      return res.status(400).json({
        error: "Missing required parameters: id and city",
        message: "Please provide both ID and city in the URL path",
        example: "/api/v1/events/123/chicago",
      });
    }

    // Validate ID is a number
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return res.status(400).json({
        error: "Invalid ID parameter",
        message: "ID must be a numeric value",
        provided: id,
      });
    }

    logger.info(`Events request: ${city} (ID: ${numericId})`);

    // Always return current database data immediately
    const { data: events, error } = await supabase
      .from("partner_events")
      .select("*")
      .eq("location_id", numericId)
      .order("date", { ascending: true });

    if (error) {
      logger.error(`Database query error for ${city}:`, {
        message: error.message,
        code: error.code,
        cityId: numericId,
      });

      return res.status(500).json({
        error: "Database error",
        message: "Failed to fetch events from database",
      });
    }

    logger.info(`Found ${events?.length || 0} events for ${city}`);

    // Check if data needs update via cache control
    const needsUpdate = await cacheControl.checkNeedsUpdate(
      numericId.toString()
    );

    if (needsUpdate) {
      logger.info(`Cache expired for ${city}, triggering background fetch`);

      // Trigger background fetch using webhook approach for serverless compatibility
      backgroundJobs.triggerBackgroundFetch(numericId, city).catch((error) => {
        logger.error(`Background fetch failed for ${city}:`, error);
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
    logger.error("Events endpoint error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "An unexpected error occurred",
    });
  }
});

module.exports = router;
