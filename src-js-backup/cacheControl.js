const supabase = require("./supabaseClient");
const logger = require("./logger");

// Cache configuration
const HOURS = 12;
const CACHE_MAX_AGE = HOURS * 60 * 60;

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

  // Upsert cache control record
  const { error } = await supabase.from("cache_control").upsert({
    location_id: locationId,
    last_update: now.toISOString(),
    next_update: nextUpdate.toISOString(),
  });

  // Throw error if update fails
  if (error) {
    logger.error(`Cache update error for location ${locationId}:`, {
      message: error.message,
      code: error.code,
    });
    throw error;
  }
};

module.exports = {
  checkNeedsUpdate,
  updateCacheTimestamp,
  ensureCacheEntry,
};
