import express, { Request, Response } from "express";
import supabase from "../services/supabaseClient";
import logger from "../services/logger";
import { TopArtist, TopArtistsResponse } from "../types";

const router = express.Router();

/**
 * GET /api/v1/top-artists
 *
 * Retrieves the top 200 touring artists from the pre-calculated database table.
 * Results can be sorted by either total shows or unique cities.
 *
 * Query Parameters:
 * - sort_by: "shows" | "cities" (default: "shows")
 * - limit: number (default: 200, max: 200)
 *
 * Example:
 * GET /api/v1/top-artists?sort_by=shows&limit=50
 * GET /api/v1/top-artists?sort_by=cities&limit=100
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const sortBy = (req.query.sort_by as string) || "shows";
    const limit = Math.min(
      parseInt((req.query.limit as string) || "200", 10),
      200
    );

    // Validate sort_by parameter
    if (sortBy !== "shows" && sortBy !== "cities") {
      return res.status(400).json({
        error: "Invalid sort_by parameter",
        message: 'sort_by must be either "shows" or "cities"',
        provided: sortBy,
      });
    }

    // Validate limit parameter
    if (Number.isNaN(limit) || limit < 1) {
      return res.status(400).json({
        error: "Invalid limit parameter",
        message: "limit must be a positive integer",
        provided: req.query.limit,
      });
    }

    // Determine which column to sort by
    const orderByColumn =
      sortBy === "shows" ? "rank_by_shows" : "rank_by_cities";

    // Query top artists from database
    const { data: topArtists, error } = await supabase
      .from("prtnr_top_artists")
      .select("*")
      .order(orderByColumn, { ascending: true })
      .limit(limit);

    if (error) {
      logger.error("Failed to fetch top artists", {
        error: error.message,
        code: error.code,
        sortBy,
        limit,
      });
      return res.status(500).json({
        error: "Database error",
        message: "Failed to fetch top artists from database",
      });
    }

    // Get the most recent calculation timestamp
    const lastUpdated =
      topArtists && topArtists.length > 0
        ? topArtists[0].last_calculated
        : null;

    const response: TopArtistsResponse = {
      data: (topArtists as TopArtist[]) || [],
      count: topArtists?.length || 0,
      last_updated: lastUpdated,
      sort_by: sortBy,
    };

    logger.info("Top artists retrieved successfully", {
      sortBy,
      limit,
      count: response.count,
    });

    return res.json(response);
  } catch (error) {
    logger.error("Top artists endpoint error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: "Internal server error",
      message: "An unexpected error occurred",
    });
  }
});

export default router;
