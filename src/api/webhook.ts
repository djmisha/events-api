import express, { Request, Response } from "express";
import { execute as fetchPartnerData } from "../jobs/fetchPartnerData";
import logger from "../services/logger";

const router = express.Router();

/**
 * Webhook endpoint for background data fetching
 * Used in serverless environments to handle async processing
 */
router.post("/fetch-partner-data", async (req: Request, res: Response) => {
  try {
    // Basic authentication check
    const authHeader = req.headers.authorization;
    const expectedSecret = process.env.WEBHOOK_SECRET || "dev-secret";

    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      logger.warn("Unauthorized webhook request", {
        authHeader,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid webhook secret",
      });
    }

    const { cityId, cityName } = req.body;

    // Validate required parameters
    if (!cityId || !cityName) {
      logger.error("Webhook missing parameters", { body: req.body });
      return res.status(400).json({
        error: "Missing required parameters",
        message: "cityId and cityName are required",
        received: { cityId, cityName },
      });
    }

    const numericCityId = parseInt(cityId, 10);
    if (Number.isNaN(numericCityId)) {
      logger.error("Invalid cityId in webhook", { cityId, cityName });
      return res.status(400).json({
        error: "Invalid cityId",
        message: "cityId must be a numeric value",
        received: cityId,
      });
    }

    logger.info(
      `Webhook executing background fetch for city: ${cityName} (ID: ${numericCityId})`
    );

    // Execute the background fetch
    const startTime = Date.now();
    await fetchPartnerData(numericCityId, cityName);
    const duration = Date.now() - startTime;

    logger.info("Webhook fetch completed successfully", {
      cityId: numericCityId,
      cityName,
      duration: `${duration}ms`,
    });

    res.status(200).json({
      success: true,
      message: "Data fetch completed successfully",
      cityId: numericCityId,
      cityName,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Webhook fetch-partner-data error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body,
    });

    res.status(500).json({
      success: false,
      error: "Background fetch failed",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Webhook endpoint for calculating top artists
 * Used for scheduled weekly calculations in serverless environments
 */
router.post("/calculate-top-artists", async (req: Request, res: Response) => {
  try {
    // Basic authentication check
    const authHeader = req.headers.authorization;
    const expectedSecret = process.env.WEBHOOK_SECRET || "dev-secret";

    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      logger.warn("Unauthorized webhook request to calculate-top-artists", {
        authHeader,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid webhook secret",
      });
    }

    logger.info("Webhook executing top artists calculation");

    // Execute the calculation job
    const startTime = Date.now();
    const { execute: calculateTopArtists } = await import(
      "../jobs/calculateTopArtists"
    );
    await calculateTopArtists();
    const duration = Date.now() - startTime;

    logger.info("Webhook top artists calculation completed successfully", {
      duration: `${duration}ms`,
    });

    res.status(200).json({
      success: true,
      message: "Top artists calculation completed successfully",
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Webhook calculate-top-artists error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: "Top artists calculation failed",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Health check endpoint for webhook service
 */
router.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    service: "webhook",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

export default router;
