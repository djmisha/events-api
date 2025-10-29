import supabase from "../services/supabaseClient";
import genreService from "../services/genres";
import ticketmasterGenresService from "../services/ticketmasterGenres";
import logger from "../services/logger";

export const execute = async (): Promise<void> => {
  logger.info("Starting event-genre backfill");

  // Fetch all Ticketmaster events from prtnr_events
  const { data: events, error } = await supabase
    .from("prtnr_events")
    .select("id, source, name")
    .eq("source", "ticketmaster");

  if (error) {
    logger.error("Failed to fetch events for backfill:", error);
    throw error;
  }

  logger.info(`Processing ${events?.length || 0} Ticketmaster events`);

  let mappedCount = 0;
  let skippedCount = 0;

  /* eslint-disable no-restricted-syntax, no-continue, no-shadow */
  for (const event of events || []) {
    try {
      // For backfill, we need to query the event metadata
      // Note: This assumes classifications are stored in event metadata
      // If not, this step will skip events without classification data
      const { data: eventData, error: eventError } = await supabase
        .from("prtnr_events")
        .select("*")
        .eq("id", event.id)
        .single();

      if (eventError || !eventData) {
        skippedCount += 1;
        continue;
      }

      // Extract classifications from metadata if available
      // This assumes the event row has a metadata column with classifications
      const metadata = (eventData as { metadata?: unknown }).metadata as
        | { classifications?: unknown[] }
        | undefined;

      if (!metadata?.classifications) {
        skippedCount += 1;
        continue;
      }

      const musicClassifications =
        ticketmasterGenresService.extractMusicClassifications(
          metadata.classifications as []
        );

      if (musicClassifications.length === 0) {
        skippedCount += 1;
        continue;
      }

      await genreService.mapEventGenres(event.id, musicClassifications);
      mappedCount += 1;
    } catch (err) {
      logger.error(`Failed to map genres for event ${event.id}:`, err);
    }
  }
  /* eslint-enable no-restricted-syntax, no-continue, no-shadow */

  logger.info(
    `Backfill complete: ${mappedCount} events mapped, ${skippedCount} skipped`
  );
};

// Allow direct execution
if (require.main === module) {
  execute()
    .then(() => {
      logger.info("Backfill completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Backfill failed:", error);
      process.exit(1);
    });
}
