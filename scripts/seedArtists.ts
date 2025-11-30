/**
 * Artist Seed Script
 *
 * Populates the artists table from the local artistDB.json file.
 * This script can be run to initialize or update the artists table
 * with pre-defined artist data.
 *
 * Usage: npm run seed:artists
 * Or: npx ts-node scripts/seedArtists.ts
 */

import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import after dotenv to ensure env vars are loaded
import artistService from "../src/services/artist";
import logger from "../src/services/logger";
import { ArtistSeedData, ArtistInput } from "../src/types";

const SEED_FILE_PATH = path.join(__dirname, "../data/artistDB.json");

async function seedArtists(): Promise<void> {
  logger.info("Starting artist seed process");

  try {
    // Check if seed file exists
    if (!fs.existsSync(SEED_FILE_PATH)) {
      logger.error(`Seed file not found at ${SEED_FILE_PATH}`);
      process.exit(1);
    }

    // Read and parse seed file
    const fileContent = fs.readFileSync(SEED_FILE_PATH, "utf-8");
    const seedData: ArtistSeedData[] = JSON.parse(fileContent);

    if (!Array.isArray(seedData)) {
      logger.error("Seed file must contain an array of artists");
      process.exit(1);
    }

    logger.info(`Found ${seedData.length} artists in seed file`);

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    // Process each artist
    for (const seedArtist of seedData) {
      try {
        if (!seedArtist.name) {
          logger.warn("Skipping artist with no name");
          results.errors++;
          continue;
        }

        const input: ArtistInput = {
          name: seedArtist.name,
          slug: seedArtist.slug,
          image: seedArtist.image || null,
          tags: seedArtist.tags || [],
          ticketmaster_id: seedArtist.ticketmaster_id || null,
          edmtrain_id: seedArtist.edmtrain_id || null,
          bio: seedArtist.bio || null,
          metadata: { source: "seed" },
        };

        // Determine source based on which ID is present
        const source = seedArtist.edmtrain_id
          ? "edmtrain"
          : seedArtist.ticketmaster_id
            ? "ticketmaster"
            : "edmtrain";

        const { action } = await artistService.upsertArtist(input, source);

        switch (action) {
          case "created":
            results.created++;
            logger.info(`Created: ${seedArtist.name}`);
            break;
          case "updated":
            results.updated++;
            logger.info(`Updated: ${seedArtist.name}`);
            break;
          case "skipped":
            results.skipped++;
            logger.info(`Skipped (already exists): ${seedArtist.name}`);
            break;
        }
      } catch (error) {
        results.errors++;
        logger.error(`Error seeding artist ${seedArtist.name}:`, error);
      }
    }

    logger.info("Seed process completed", results);
    logger.info(
      `Summary: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped, ${results.errors} errors`
    );
  } catch (error) {
    logger.error("Seed process failed:", error);
    process.exit(1);
  }
}

// Run the seed function
seedArtists()
  .then(() => {
    logger.info("Seed script finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Seed script failed:", error);
    process.exit(1);
  });
