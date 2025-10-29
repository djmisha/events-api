import ticketmasterGenresService from "../services/ticketmasterGenres";
import genreService from "../services/genres";
import logger from "../services/logger";

export const execute = async (): Promise<void> => {
  logger.info("Starting genre bootstrap from Ticketmaster");

  try {
    // Fetch all music genres
    const genres = await ticketmasterGenresService.fetchMusicGenres();

    // Upsert each genre
    let createdCount = 0;
    let updatedCount = 0;

    /* eslint-disable no-restricted-syntax */
    for (const genre of genres) {
      try {
        const result = await genreService.upsertGenre({
          name: genre.name,
          ticketmaster_genre_id: genre.id,
          ticketmaster_segment_id: genre.segment?.id || null,
        });

        if (result.created) {
          createdCount += 1;
        } else {
          updatedCount += 1;
        }
      } catch (err) {
        logger.error(`Failed to upsert genre ${genre.name}:`, err);
        // Continue with other genres
      }
    }
    /* eslint-enable no-restricted-syntax */

    logger.info(
      `Genre bootstrap complete: ${createdCount} created, ${updatedCount} updated`
    );
  } catch (error) {
    logger.error("Genre bootstrap failed:", error);
    throw error;
  }
};

// Allow direct execution
if (require.main === module) {
  execute()
    .then(() => {
      logger.info("Bootstrap completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Bootstrap failed:", error);
      process.exit(1);
    });
}
