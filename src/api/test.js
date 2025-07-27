const express = require("express");
const edmTrainService = require("../services/edmTrain");
const ticketmasterService = require("../services/ticketmaster");
const transform = require("../utils/transform");
const logger = require("../services/logger");

const router = express.Router();

// Test endpoint for EDM Train API
router.get("/edmtrain/:id/:city", async (req, res) => {
  try {
    const { id, city } = req.params;

    if (!id || !city) {
      return res.status(400).json({
        error: "Missing required parameters: id and city",
        message: "Please provide both id and city in the URL path",
        example: "/api/test/edmtrain/123/chicago",
      });
    }

    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return res.status(400).json({
        error: "Invalid id parameter",
        message: "id must be a numeric value",
      });
    }

    logger.info(`Testing EDM Train API for city: ${city} (ID: ${numericId})`);

    // Fetch raw data from EDM Train
    const rawEvents = await edmTrainService.fetchEvents(numericId, city);

    // Transform the data
    const transformedEvents = transform.normalizeEdmTrainEvents(
      rawEvents,
      numericId,
      city
    );

    res.json({
      source: "edmtrain",
      id: numericId,
      city: city,
      rawCount: rawEvents.length,
      transformedCount: transformedEvents.length,
      rawData: rawEvents,
      transformedData: transformedEvents,
    });
  } catch (error) {
    logger.error("EDM Train test endpoint error:", error);
    res.status(500).json({
      error: "EDM Train API error",
      message: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Test endpoint for Ticketmaster API
router.get("/ticketmaster/:id/:city", async (req, res) => {
  try {
    const { id, city } = req.params;

    if (!id || !city) {
      return res.status(400).json({
        error: "Missing required parameters: id and city",
        message: "Please provide both id and city in the URL path",
        example: "/api/test/ticketmaster/123/chicago",
      });
    }

    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return res.status(400).json({
        error: "Invalid id parameter",
        message: "id must be a numeric value",
      });
    }

    logger.info(
      `Testing Ticketmaster API for city: ${city} (ID: ${numericId})`
    );

    // Fetch raw data from Ticketmaster
    const rawEvents = await ticketmasterService.fetchEvents(city);

    // Transform the data
    const transformedEvents = transform.normalizeTicketmasterEvents(
      rawEvents,
      numericId,
      city
    );

    res.json({
      source: "ticketmaster",
      id: numericId,
      city: city,
      rawCount: rawEvents.length,
      transformedCount: transformedEvents.length,
      rawData: rawEvents,
      transformedData: transformedEvents,
    });
  } catch (error) {
    logger.error("Ticketmaster test endpoint error:", error);
    res.status(500).json({
      error: "Ticketmaster API error",
      message: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Test endpoint for both APIs combined
router.get("/combined/:id/:city", async (req, res) => {
  try {
    const { id, city } = req.params;

    if (!id || !city) {
      return res.status(400).json({
        error: "Missing required parameters: id and city",
        message: "Please provide both id and city in the URL path",
        example: "/api/test/combined/123/chicago",
      });
    }

    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return res.status(400).json({
        error: "Invalid id parameter",
        message: "id must be a numeric value",
      });
    }

    logger.info(`Testing both APIs for city: ${city} (ID: ${numericId})`);

    // Fetch from both sources in parallel
    const [edmTrainResult, ticketmasterResult] = await Promise.allSettled([
      edmTrainService.fetchEvents(numericId, city),
      ticketmasterService.fetchEvents(city),
    ]);

    const results = {
      id: numericId,
      city: city,
      edmtrain: {
        status: edmTrainResult.status,
        data:
          edmTrainResult.status === "fulfilled" ? edmTrainResult.value : null,
        error:
          edmTrainResult.status === "rejected"
            ? edmTrainResult.reason.message
            : null,
      },
      ticketmaster: {
        status: ticketmasterResult.status,
        data:
          ticketmasterResult.status === "fulfilled"
            ? ticketmasterResult.value
            : null,
        error:
          ticketmasterResult.status === "rejected"
            ? ticketmasterResult.reason.message
            : null,
      },
    };

    // Transform successful results
    if (results.edmtrain.data) {
      results.edmtrain.transformed = transform.normalizeEdmTrainEvents(
        results.edmtrain.data,
        numericId,
        city
      );
    }

    if (results.ticketmaster.data) {
      results.ticketmaster.transformed = transform.normalizeTicketmasterEvents(
        results.ticketmaster.data,
        numericId,
        city
      );
    }

    // Combine all transformed events
    const allEvents = [
      ...(results.edmtrain.transformed || []),
      ...(results.ticketmaster.transformed || []),
    ];

    results.combined = {
      totalEvents: allEvents.length,
      events: allEvents,
    };

    res.json(results);
  } catch (error) {
    logger.error("Combined test endpoint error:", error);
    res.status(500).json({
      error: "Combined API test error",
      message: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

module.exports = router;
