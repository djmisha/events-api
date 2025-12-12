import supabase from "./supabaseClient";
import logger from "./logger";

// Cache configuration
const HOURS = 24;
const CACHE_MAX_AGE = HOURS * 60 * 60;

/**
 * Ensures a cache entry exists for the given location
 * If no entry exists, creates one with immediate update needed
 */
const ensureCacheEntry = async (locationId: number): Promise<void> => {
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
    const { error: insertError } = await supabase.from("cache_control").insert({
      location_id: locationId,
      last_update: now.toISOString(),
      next_update: now.toISOString(),
    });

    if (insertError) {
      logger.error("Cache entry creation error:", insertError);
    }
  }
};

/**
 * Gets the cache status for a location
 */
const getCacheStatus = async (
  locationId: number
): Promise<"fresh" | "stale"> => {
  await ensureCacheEntry(locationId);

  const { data, error } = await supabase
    .from("cache_control")
    .select("next_update")
    .eq("location_id", locationId)
    .single();

  if (error) {
    logger.error("Cache status check error:", error);
    return "stale"; // Default to stale on error
  }

  const nextUpdate = new Date(data.next_update);
  const now = new Date();

  return now > nextUpdate ? "stale" : "fresh";
};

/**
 * Updates the cache timestamp for a location
 */
const updateCacheTimestamp = async (locationId: number): Promise<void> => {
  const now = new Date();
  const nextUpdate = new Date(now.getTime() + CACHE_MAX_AGE * 1000);

  const { error } = await supabase
    .from("cache_control")
    .update({
      last_update: now.toISOString(),
      next_update: nextUpdate.toISOString(),
    })
    .eq("location_id", locationId);

  if (error) {
    logger.error("Cache timestamp update error:", error);
  }
};

export default {
  getCacheStatus,
  updateCacheTimestamp,
  ensureCacheEntry,
};
