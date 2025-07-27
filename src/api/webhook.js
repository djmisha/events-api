const express = require("express");
const fetchData = require("../jobs/fetchData");
const logger = require("../services/logger");

const router = express.Router();

/**
 * Webhook endpoint for background data fetching
 * Used in serverless environments to handle async processing
 */
router.post("/fetch-data", async (req, res) => {
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
    if (isNaN(numericCityId)) {
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
    await fetchData.execute(numericCityId, cityName);
    const duration = Date.now() - startTime;

    logger.info(`Webhook fetch completed successfully`, {
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
    logger.error("Webhook fetch-data error:", {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });

    res.status(500).json({
      success: false,
      error: "Background fetch failed",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Health check endpoint for webhook service
 */
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "webhook",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

module.exports = router;
