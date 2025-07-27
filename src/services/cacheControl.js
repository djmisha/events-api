const supabase = require("./supabaseClient");
const logger = require("./logger");

// Cache configuration constants
const HOURS = 6;
const CACHE_MAX_AGE = HOURS * 60 * 60; // 6 hours in seconds

/**
 * Ensures a cache entry exists for the given location
 * If no entry exists, creates one with immediate update needed
 * @param {string} locationId - The ID of the location to initialize
 */
const ensureCacheEntry = async (locationId) => {
  const { data, error } = await supabase
    .from("cache_control")
    .select("location_id")
    .eq("location_id", locationId)
    .maybeSingle();

  if (error) {
    logger.error("Cache initialization error:", error);
    return;
  }

  if (!data) {
    const now = new Date();
    // Create initial cache entry with expired timestamp to force update
    const { error: insertError } = await supabase.from("cache_control").insert({
      location_id: locationId,
      last_update: now.toISOString(),
      next_update: now.toISOString(), // Set to current time to trigger immediate update
    });

    if (insertError) {
      logger.error("Cache entry creation error:", insertError);
    }
  }
};

/**
 * Determines if a location's cached data needs to be updated
 * @param {string} locationId - The ID of the location to check
 * @returns {Promise<boolean>} - True if cache needs update, false otherwise
 */
const checkNeedsUpdate = async (locationId) => {
  // Ensure cache entry exists before checking
  await ensureCacheEntry(locationId);

  const now = new Date();

  // Query the cache_control table for the location's next update time
  const { data, error } = await supabase
    .from("cache_control")
    .select("next_update")
    .eq("location_id", locationId)
    .maybeSingle();

  if (error) {
    logger.error("Cache check error:", error);
    return true; // If there's an error, assume we need to update
  }

  if (!data) {
    return true; // If no data found, we need to update
  }

  const nextUpdateTime = new Date(data.next_update);
  return now >= nextUpdateTime; // Return true if current time is past the next update time
};

/**
 * Updates the cache timestamp for a location
 * Sets both the last_update time (now) and next_update time (now + cache duration)
 * @param {string} locationId - The ID of the location to update
 * @throws Will throw an error if the database update fails
 */
const updateCacheTimestamp = async (locationId) => {
  const now = new Date();
  const nextUpdate = new Date(now.getTime() + CACHE_MAX_AGE * 1000);

  // Log cache timing details for debugging
  logger.info(`Cache timing - Location: ${locationId}, Current: ${now.toISOString()}, Next Update: ${nextUpdate.toISOString()}, TTL: ${HOURS} hours`);

  // Upsert cache control record
  const { error } = await supabase.from("cache_control").upsert({
    location_id: locationId,
    last_update: now.toISOString(),
    next_update: nextUpdate.toISOString(),
  });

  // Throw error if update fails
  if (error) {
    logger.error("Cache update error:", {
      locationId,
      error: error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    console.error("Full Cache Update Error:", JSON.stringify(error, null, 2));
    throw error;
  }

  logger.info(`Cache update successful - Location: ${locationId}, Last Update: ${now.toISOString()}, Next Update: ${nextUpdate.toISOString()}`);
};

module.exports = {
  checkNeedsUpdate,
  updateCacheTimestamp,
  ensureCacheEntry,
};
