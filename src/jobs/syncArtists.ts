/**
 * Artist Sync Background Job
 *
 * Synchronizes artists from the prtnr_artists (partner events artists) table
 * into the master artists table.
 *
 * Features:
 * - Processes all artists from prtnr_artists table
 * - Deduplicates by matching external IDs or name
 * - Fills in missing data for existing artists (never deletes data)
 * - Handles both EDM Train and Ticketmaster sources
 *
 * This job should be run periodically to keep the artists table updated
 * with new artists from incoming events.
 */

import artistService from "../services/artist";
import logger from "../services/logger";
import { ArtistSyncResult } from "../types";

/**
 * Execute the artist sync job
 */
export async function execute(): Promise<ArtistSyncResult> {
  logger.info("Starting artist sync job");
  const startTime = Date.now();

  try {
    const result = await artistService.syncArtistsFromPartnerTable();

    const duration = Date.now() - startTime;
    logger.info("Artist sync job completed", {
      ...result,
      duration: `${duration}ms`,
    });

    return result;
  } catch (error) {
    logger.error("Artist sync job failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export default {
  execute,
};
