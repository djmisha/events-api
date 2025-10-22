import logger from "./logger";

// Construct the webhook URL based on environment
function getWebhookUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/webhook/fetch-partner-data`;
  }
  return `${process.env.BASE_URL || "http://localhost:8000"}/api/webhook/fetch-partner-data`;
}

interface BackgroundFetchResult {
  triggered: boolean;
  method: "webhook" | "direct";
}

/**
 * Triggers background data fetching based on environment
 * In Vercel (serverless), uses webhook approach
 * In development, executes directly
 */
const triggerBackgroundFetch = async (
  cityId: number,
  cityName: string
): Promise<BackgroundFetchResult> => {
  try {
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      const webhookUrl = getWebhookUrl();
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
    }
    // Development environment - direct execution
    const fetchPartnerData = await import("../jobs/fetchPartnerData");
    await fetchPartnerData.execute(cityId, cityName);
    return { triggered: true, method: "direct" };
  } catch (error) {
    logger.error(`Background fetch trigger error for ${cityName}:`, error);
    throw error;
  }
};

export default {
  triggerBackgroundFetch,
};
