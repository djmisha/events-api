import express, { Request, Response } from "express";
import edmTrainService from "../services/edmTrain";
import ticketmasterService from "../services/ticketmaster";
import transform from "../utils/transform";
import logger from "../services/logger";

const router = express.Router();

// Test endpoint for EDM Train API
router.get("/edmtrain/:id/:city", async (req: Request, res: Response) => {
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
    if (Number.isNaN(numericId)) {
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
      numericId
    );

    res.json({
      source: "edmtrain",
      id: numericId,
      city,
      rawCount: rawEvents.length,
      transformedCount: transformedEvents.length,
      rawData: rawEvents,
      transformedData: transformedEvents,
    });
  } catch (error) {
    logger.error("EDM Train test endpoint error:", error);
    res.status(500).json({
      error: "EDM Train API error",
      message: error instanceof Error ? error.message : "Unknown error",
      details: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
});

// Test endpoint for Ticketmaster API
router.get("/ticketmaster/:id/:city", async (req: Request, res: Response) => {
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
    if (Number.isNaN(numericId)) {
      return res.status(400).json({
        error: "Invalid id parameter",
        message: "id must be a numeric value",
      });
    }

    logger.info(
      `Testing Ticketmaster API for city: ${city} (ID: ${numericId})`
    );

    // Fetch raw data from Ticketmaster
    const rawEvents = await ticketmasterService.fetchEvents(numericId, city);

    // Transform the data
    const transformedEvents = transform.normalizeTicketmasterEvents(
      rawEvents,
      numericId
    );

    res.json({
      source: "ticketmaster",
      id: numericId,
      city,
      rawCount: rawEvents.length,
      transformedCount: transformedEvents.length,
      rawData: rawEvents,
      transformedData: transformedEvents,
    });
  } catch (error) {
    logger.error("Ticketmaster test endpoint error:", error);
    res.status(500).json({
      error: "Ticketmaster API error",
      message: error instanceof Error ? error.message : "Unknown error",
      details: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
});

// Test endpoint for combined data
router.get("/combined/:id/:city", async (req: Request, res: Response) => {
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
    if (Number.isNaN(numericId)) {
      return res.status(400).json({
        error: "Invalid id parameter",
        message: "id must be a numeric value",
      });
    }

    logger.info(`Testing combined APIs for city: ${city} (ID: ${numericId})`);

    // Fetch from both sources
    const [edmTrainEvents, ticketmasterEvents] = await Promise.allSettled([
      edmTrainService.fetchEvents(numericId, city),
      ticketmasterService.fetchEvents(numericId, city),
    ]);

    const edmTrainData =
      edmTrainEvents.status === "fulfilled" ? edmTrainEvents.value : [];
    const ticketmasterData =
      ticketmasterEvents.status === "fulfilled" ? ticketmasterEvents.value : [];

    // Transform both datasets
    const transformedEdmTrain = transform.normalizeEdmTrainEvents(
      edmTrainData,
      numericId
    );
    const transformedTicketmaster = transform.normalizeTicketmasterEvents(
      ticketmasterData,
      numericId
    );

    const combinedEvents = [...transformedEdmTrain, ...transformedTicketmaster];

    res.json({
      source: "combined",
      id: numericId,
      city,
      edmTrain: {
        rawCount: edmTrainData.length,
        transformedCount: transformedEdmTrain.length,
        status: edmTrainEvents.status,
      },
      ticketmaster: {
        rawCount: ticketmasterData.length,
        transformedCount: transformedTicketmaster.length,
        status: ticketmasterEvents.status,
      },
      combined: {
        totalCount: combinedEvents.length,
        data: combinedEvents,
      },
    });
  } catch (error) {
    logger.error("Combined test endpoint error:", error);
    res.status(500).json({
      error: "Combined API error",
      message: error instanceof Error ? error.message : "Unknown error",
      details: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
});

// Test endpoint for top artists calculation
router.get("/calculate-top-artists", async (req: Request, res: Response) => {
  try {
    logger.info("Testing top artists calculation job");

    // Execute the calculation job
    const startTime = Date.now();
    const { execute: calculateTopArtists } = await import(
      "../jobs/calculateTopArtists"
    );
    await calculateTopArtists();
    const duration = Date.now() - startTime;

    logger.info("Top artists calculation test completed successfully");

    res.json({
      success: true,
      message: "Top artists calculation completed successfully",
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      note: "Check database prtnr_top_artists table for results",
    });
  } catch (error) {
    logger.error("Top artists test endpoint error:", error);
    res.status(500).json({
      error: "Top artists calculation error",
      message: error instanceof Error ? error.message : "Unknown error",
      details: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
});

export default router;
