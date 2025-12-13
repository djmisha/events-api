/**
 * Artist API Routes
 *
 * Provides endpoints for querying artist information.
 * Supports search by ID (UUID), slug, or name.
 *
 * Endpoints:
 * - GET /api/v1/artists - List all artists (paginated)
 * - GET /api/v1/artists/search?q=name - Search artists by name
 * - GET /api/v1/artists/:identifier - Get artist by ID, slug, or external ID
 */

import express, { Request, Response } from "express";
import logger from "../services/logger";
import * as artistService from "../services/artist";
import { ArtistApiResponse } from "../types";

const router = express.Router();

// API pagination and search limits
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;

/**
 * GET /api/v1/artists
 * List all artists with pagination
 *
 * Query params:
 *   - page: Page number (1-indexed, default: 1)
 *   - limit: Results per page (default: 50, max: 100)
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || DEFAULT_PAGE;
    const limit = Math.min(
      parseInt(req.query.limit as string, 10) || DEFAULT_PAGE_LIMIT,
      MAX_PAGE_LIMIT
    );

    const { artists, total } = await artistService.getAllArtists(page, limit);

    const response: ArtistApiResponse = {
      data: artists,
      count: artists.length,
      message: `Page ${page} of ${Math.ceil(total / limit)}`,
    };

    res.json({
      ...response,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Error in GET /artists:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch artists",
    });
  }
});

/**
 * GET /api/v1/artists/search
 * Search artists by name (case-insensitive partial match)
 *
 * Query params:
 *   - q: Search query (required)
 *   - limit: Max results (default: 10, max: 50)
 */
router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const limit = Math.min(
      parseInt(req.query.limit as string, 10) || DEFAULT_SEARCH_LIMIT,
      MAX_SEARCH_LIMIT
    );

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        error: "Bad request",
        message: "Query parameter 'q' is required",
      });
    }

    const artists = await artistService.searchArtistsByName(query, limit);

    const response: ArtistApiResponse = {
      data: artists,
      count: artists.length,
      message:
        artists.length > 0
          ? `Found ${artists.length} artist(s) matching "${query}"`
          : `No artists found matching "${query}"`,
    };

    return res.json(response);
  } catch (error) {
    logger.error("Error in GET /artists/search:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to search artists",
    });
  }
});

/**
 * GET /api/v1/artists/:identifier
 * Get artist by ID (UUID), slug, or external ID
 *
 * The identifier can be:
 * - A UUID (36 characters with dashes)
 * - A slug (lowercase alphanumeric with dashes)
 * - An external ID with source prefix (e.g., "edmtrain:12345" or "ticketmaster:abc123")
 */
router.get("/:identifier", async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      return res.status(400).json({
        error: "Bad request",
        message: "Artist identifier is required",
      });
    }

    let artist = null;

    // Check if it's a UUID (36 chars with specific format)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(identifier)) {
      artist = await artistService.getArtistById(identifier);
    }

    // Check if it's an external ID (source:id format)
    if (!artist && identifier.includes(":")) {
      const [source, externalId] = identifier.split(":");
      if ((source === "edmtrain" || source === "ticketmaster") && externalId) {
        artist = await artistService.getArtistByExternalId(source, externalId);
      }
    }

    // Try as slug
    if (!artist) {
      artist = await artistService.getArtistBySlug(identifier.toLowerCase());
    }

    // If still not found, try searching by name
    if (!artist) {
      const searchResults = await artistService.searchArtistsByName(
        identifier,
        1
      );
      if (searchResults.length > 0) {
        // Check for exact match (case-insensitive)
        const exactMatch = searchResults.find(
          (a) => a.name.toLowerCase() === identifier.toLowerCase()
        );
        artist = exactMatch || searchResults[0];
      }
    }

    if (!artist) {
      return res.status(404).json({
        error: "Not found",
        message: `No artist found with identifier "${identifier}"`,
        hint: "You can search by UUID, slug, external ID (edmtrain:123 or ticketmaster:abc), or artist name",
      });
    }

    const response: ArtistApiResponse = {
      data: artist,
      count: 1,
      message: "Artist found",
    };

    return res.json(response);
  } catch (error) {
    logger.error("Error in GET /artists/:identifier:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch artist",
    });
  }
});

export default router;
