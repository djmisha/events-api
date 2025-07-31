const logger = require("./logger");

// Import fetch for Node.js environments that don't have it built-in
const fetch = globalThis.fetch || require("node-fetch");

/**
 * Triggers background data fetching based on environment
 * In Vercel (serverless), uses webhook approach
 * In development, executes directly
 */
const triggerBackgroundFetch = async (cityId, cityName) => {
  try {
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      // Serverless environment - use webhook approach
      const webhookUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}/api/webhook/fetch-data`
        : `${
            process.env.BASE_URL || "http://localhost:8000"
          }/api/webhook/fetch-data`;

      logger.info(`Triggering background fetch via webhook for ${cityName}`);

      // Fire and forget webhook call
      fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.WEBHOOK_SECRET || "dev-secret"}`,
        },
        body: JSON.stringify({
          cityId: cityId.toString(),
          cityName,
        }),
      }).catch((error) => {
        logger.error(`Webhook trigger failed for ${cityName}:`, error.message);
      });

      return { triggered: true, method: "webhook" };
    } else {
      // Development environment - direct execution
      const fetchData = require("../jobs/fetchData");
      await fetchData.execute(cityId, cityName);
      return { triggered: true, method: "direct" };
    }
  } catch (error) {
    logger.error(`Background fetch trigger error for ${cityName}:`, error);
    throw error;
  }
};

module.exports = {
  triggerBackgroundFetch,
};
