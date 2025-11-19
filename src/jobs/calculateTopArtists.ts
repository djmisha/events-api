/**
 * Calculate Top Artists Job
 *
 * This job calculates the top 200 touring artists based on:
 * 1. Total number of shows/events (rank_by_shows)
 * 2. Number of unique cities where they've performed (rank_by_cities)
 *
 * The job queries the prtnr_event_artists and prtnr_events tables,
 * calculates statistics, and stores the top 200 artists in prtnr_top_artists table.
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
 * 2. Calculate total shows and unique cities per artist
 * 3. Rank artists by both metrics
 * 4. Store top 200 artists (by shows) in prtnr_top_artists table
 * 5. Clear old data and insert fresh calculations
 *
 * @returns Promise that resolves when calculation is complete
 */
export async function execute(): Promise<void> {
  const startTime = Date.now();
  logger.info("Starting top artists calculation job");

  try {
    // Step 1: Fetch all event-artist relationships with event data
    // We need the event's location_id to count unique cities
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
      .order("artist_id");

    if (fetchError) {
      logger.error("Failed to fetch event-artist data", {
        error: fetchError.message,
        code: fetchError.code,
      });
      throw fetchError;
    }

    if (!eventArtists || eventArtists.length === 0) {
      logger.warn("No event-artist data found, skipping calculation");
      return;
    }

    // Step 2: Calculate statistics per artist
    // Group by artist_id and count total shows and unique cities
    const artistStatsMap = new Map<string, TopArtistStats>();

    eventArtists.forEach((ea: any) => {
      const artistId = ea.artist_id;
      const artistName = ea.prtnr_artists?.name;
      const locationId = ea.prtnr_events?.location_id;

      if (!artistId || !artistName || !locationId) return;

      if (!artistStatsMap.has(artistId)) {
        artistStatsMap.set(artistId, {
          artist_id: artistId,
          artist_name: artistName,
          total_shows: 0,
          unique_cities: 0,
        });
      }

      const stats = artistStatsMap.get(artistId)!;
      stats.total_shows += 1;

      // Track unique cities using a Set (we'll need to add city tracking)
      // For now, we'll use a temporary approach
    });

    // Recalculate with unique cities tracking
    const artistCitiesMap = new Map<string, Set<number>>();

    eventArtists.forEach((ea: any) => {
      const artistId = ea.artist_id;
      const locationId = ea.prtnr_events?.location_id;

      if (!artistId || !locationId) return;

      if (!artistCitiesMap.has(artistId)) {
        artistCitiesMap.set(artistId, new Set());
      }

      artistCitiesMap.get(artistId)!.add(locationId);
    });

    // Update unique_cities count in stats
    artistStatsMap.forEach((stats, artistId) => {
      const cities = artistCitiesMap.get(artistId);
      const updatedStats = {
        ...stats,
        unique_cities: cities ? cities.size : 0,
      };
      artistStatsMap.set(artistId, updatedStats);
    });

    // Step 3: Sort artists by total shows and assign ranks
    const artistsByShows = Array.from(artistStatsMap.values()).sort(
      (a, b) => b.total_shows - a.total_shows
    );

    // Step 4: Sort artists by unique cities and create rank mapping
    const artistsByCities = Array.from(artistStatsMap.values()).sort(
      (a, b) => b.unique_cities - a.unique_cities
    );

    const rankByCitiesMap = new Map<string, number>();
    artistsByCities.forEach((artist, index) => {
      rankByCitiesMap.set(artist.artist_id, index + 1);
    });

    // Step 5: Prepare top 200 artists (by shows) for insertion
    const top200Artists = artistsByShows.slice(0, 200).map((artist, index) => ({
      artist_id: artist.artist_id,
      artist_name: artist.artist_name,
      total_shows: artist.total_shows,
      unique_cities: artist.unique_cities,
      rank_by_shows: index + 1,
      rank_by_cities: rankByCitiesMap.get(artist.artist_id) || null,
      last_calculated: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    logger.info(
      `Calculated top ${top200Artists.length} artists from ${artistStatsMap.size} total artists`
    );

    // Step 6: Clear old data and insert new calculations
    // Delete all existing records first
    const { error: deleteError } = await supabase
      .from("prtnr_top_artists")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all (using a condition that's always true)

    if (deleteError) {
      logger.error("Failed to clear old top artists data", {
        error: deleteError.message,
        code: deleteError.code,
      });
      throw deleteError;
    }

    // Insert new top artists data
    const { error: insertError } = await supabase
      .from("prtnr_top_artists")
      .insert(top200Artists);

    if (insertError) {
      logger.error("Failed to insert top artists data", {
        error: insertError.message,
        code: insertError.code,
        count: top200Artists.length,
      });
      throw insertError;
    }

    const duration = Date.now() - startTime;
    logger.info("Top artists calculation completed successfully", {
      totalArtists: artistStatsMap.size,
      top200Count: top200Artists.length,
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
