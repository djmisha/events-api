/**
 * Calculate Top Artists Job
 *
 * This job calculates the top 900 touring artists based on:
 * 1. Total number of shows/events (rank_by_shows)
 * 2. Number of unique cities where they've performed (rank_by_cities)
 *
 * The job queries the prtnr_event_artists and prtnr_events tables,
 * calculates statistics, and stores the top 900 artists in prtnr_top_artists table.
 *
 * Designed for serverless environments:
 * - Runs via webhook endpoint on a weekly schedule
 * - Efficient batch operations to minimize database round trips
 * - Replaces entire dataset each run for consistency
 */

import supabase from "../services/supabaseClient";
import logger from "../services/logger";
import { TopArtistStats } from "../types";

/**
 * Main execution function for calculating top artists
 *
 * Process:
 * 1. Query all event-artist relationships with event dates and locations
 * 2. Calculate total shows and unique cities per artist in a single pass
 * 3. Rank artists by both metrics
 * 4. Store top 900 artists (by shows) in prtnr_top_artists table
 * 5. Clear old data and insert fresh calculations
 *
 * @returns Promise that resolves when calculation is complete
 */
export async function execute(): Promise<void> {
  const startTime = Date.now();
  logger.info("Starting top artists calculation job");

  try {
    // Step 1: Fetch all event-artist relationships with event data
    // Supabase has a default limit of 1000 records, so we need to paginate
    logger.info("Starting to fetch event-artist data from database");

    let allEventArtists: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: eventArtists, error: fetchError } = await supabase
        .from("prtnr_event_artists")
        .select(
          `
          artist_id,
          prtnr_artists (
            id,
            name
          ),
          prtnr_events!inner (
            id,
            location_id
          )
        `
        )
        .order("artist_id")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (fetchError) {
        logger.error("Failed to fetch event-artist data", {
          error: fetchError.message,
          code: fetchError.code,
        });
        throw fetchError;
      }

      if (!eventArtists || eventArtists.length === 0) {
        hasMore = false;
      } else {
        allEventArtists = allEventArtists.concat(eventArtists);
        if (eventArtists.length < pageSize) {
          hasMore = false;
        }
        page += 1;
      }
    }

    if (allEventArtists.length === 0) {
      logger.warn("No event-artist data found, skipping calculation");
      return;
    }

    logger.info(
      `Processing ${allEventArtists.length} event-artist relationships`
    );

    // Step 2: Calculate statistics per artist in a single pass
    // Track both total shows and unique cities simultaneously
    const artistStatsMap = new Map<
      string,
      {
        artist_id: string;
        artist_name: string;
        total_shows: number;
        cities: Set<number>;
      }
    >();

    let skippedRecords = 0;

    allEventArtists.forEach((ea: any) => {
      const artistId = ea.artist_id;
      const artistName = ea.prtnr_artists?.name;
      const locationId = ea.prtnr_events?.location_id;

      // Validate required fields
      if (!artistId || !artistName || !locationId) {
        skippedRecords += 1;
        return;
      }

      if (!artistStatsMap.has(artistId)) {
        artistStatsMap.set(artistId, {
          artist_id: artistId,
          artist_name: artistName,
          total_shows: 0,
          cities: new Set(),
        });
      }

      const stats = artistStatsMap.get(artistId)!;
      stats.total_shows += 1;
      stats.cities.add(locationId);
    });

    if (skippedRecords > 0) {
      logger.warn(`Skipped ${skippedRecords} records due to missing data`);
    }

    logger.info(`Calculated stats for ${artistStatsMap.size} unique artists`);

    // Step 3: Convert to final stats format with unique cities count
    const allArtistStats: TopArtistStats[] = Array.from(
      artistStatsMap.values()
    ).map((stats) => ({
      artist_id: stats.artist_id,
      artist_name: stats.artist_name,
      total_shows: stats.total_shows,
      unique_cities: stats.cities.size,
    }));

    // Step 4: Sort by total shows (descending), then by unique cities (descending) for tie-breaking
    const artistsByShows = [...allArtistStats].sort((a, b) => {
      if (b.total_shows !== a.total_shows) {
        return b.total_shows - a.total_shows;
      }
      return b.unique_cities - a.unique_cities;
    });

    // Step 5: Sort by unique cities (descending), then by total shows for tie-breaking
    const artistsByCities = [...allArtistStats].sort((a, b) => {
      if (b.unique_cities !== a.unique_cities) {
        return b.unique_cities - a.unique_cities;
      }
      return b.total_shows - a.total_shows;
    });

    // Create rank mapping for cities
    const rankByCitiesMap = new Map<string, number>();
    artistsByCities.forEach((artist, index) => {
      rankByCitiesMap.set(artist.artist_id, index + 1);
    });

    // Step 6: Prepare top 900 artists (by shows) for insertion
    const top900Artists = artistsByShows.slice(0, 900).map((artist, index) => ({
      artist_id: artist.artist_id,
      artist_name: artist.artist_name,
      total_shows: artist.total_shows,
      unique_cities: artist.unique_cities,
      rank_by_shows: index + 1,
      rank_by_cities: rankByCitiesMap.get(artist.artist_id) || null,
      last_calculated: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    logger.info("Top artists calculated", {
      totalArtists: allArtistStats.length,
      top900Count: top900Artists.length,
    });

    // Step 7: Clear old data - use proper delete without unnecessary condition
    const { error: deleteError } = await supabase
      .from("prtnr_top_artists")
      .delete()
      .gte("rank_by_shows", 1); // Delete all records (rank >= 1 covers everything)

    if (deleteError) {
      logger.error("Failed to clear old top artists data", {
        error: deleteError.message,
        code: deleteError.code,
      });
      throw deleteError;
    }

    // Step 8: Insert new top artists data
    if (top900Artists.length > 0) {
      const { error: insertError } = await supabase
        .from("prtnr_top_artists")
        .insert(top900Artists);

      if (insertError) {
        logger.error("Failed to insert top artists data", {
          error: insertError.message,
          code: insertError.code,
          count: top900Artists.length,
        });
        throw insertError;
      }
    }

    const duration = Date.now() - startTime;
    logger.info("Top artists calculation completed successfully", {
      totalArtists: allArtistStats.length,
      top900Count: top900Artists.length,
      skippedRecords,
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Top artists calculation failed", {
      error: error instanceof Error ? error.message : String(error),
      duration: `${duration}ms`,
    });
    throw error;
  }
}
