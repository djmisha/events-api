const supabase = require("../services/supabaseClient");
const logger = require("../services/logger");

const execute = async () => {
  logger.info("Starting cleanup job - removing past events");

  try {
    const now = new Date().toISOString();

    // Delete events that have already occurred
    const { data: deletedEvents, error } = await supabase
      .from("partner_events")
      .delete()
      .lt("date", now)
      .select("id");

    if (error) {
      logger.error("Failed to delete past events:", error);
      throw error;
    }

    if (deletedEvents && deletedEvents.length > 0) {
      logger.info(`Deleted ${deletedEvents.length} past events`);
    } else {
      logger.info("No past events found to delete");
    }
  } catch (error) {
    logger.error("Cleanup job failed:", error);
    throw error;
  }
};

module.exports = {
  execute,
};
