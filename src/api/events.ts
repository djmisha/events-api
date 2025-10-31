import express, { Request, Response } from "express";
import supabase from "../services/supabaseClient";
import logger from "../services/logger";
import cacheControl from "../services/cacheControl";
import backgroundJobs from "../services/backgroundJobs";
import { PartnerEvent, ApiResponse, EventWithGenres } from "../types";

const router = express.Router();

router.get("/:id/:city", async (req: Request, res: Response) => {
  try {
    const { id, city } = req.params;

    if (!id || !city) {
      return res.status(400).json({
        error: "Missing required parameters: id and city",
        message: "Please provide both ID and city in the URL path",
        example: "/api/v1/events/123/chicago",
      });
    }

    const numericId = parseInt(id, 10);
    if (Number.isNaN(numericId)) {
      return res.status(400).json({
        error: "Invalid ID parameter",
        message: "ID must be a numeric value",
        provided: id,
      });
    }

    // Check cache status
    const cacheStatus = await cacheControl.getCacheStatus(numericId);
    logger.info(`Cache status for ${city} (${numericId}): ${cacheStatus}`);

    // Always fetch current data from database first with joins for genres, venues, and artists
    const { data: events, error } = await supabase
      .from("prtnr_events")
      .select(
        `
        *,
        prtnr_event_genres (
          classification_primary,
          prtnr_genres (
            id,
            name,
            normalized_name,
            ticketmaster_genre_id
          )
        )
      `
      )
      .eq("location_id", numericId)
      .gte("date", new Date().toISOString().split("T")[0])
      .order("date", { ascending: true });

    if (error) {
      logger.error(`Database query failed for ${city}:`, error);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to fetch events from database",
      });
    }

    // If cache is stale, trigger background refresh
    if (cacheStatus === "stale") {
      logger.info(`Triggering background refresh for ${city} (${numericId})`);
      setImmediate(() => {
        backgroundJobs
          .triggerBackgroundFetch(numericId, city)
          .catch((fetchError) => {
            logger.error(`Background fetch failed for ${city}:`, fetchError);
          });
      });
    }

    // Transform events to include genres in a more accessible format
    const eventsWithGenres: EventWithGenres[] = (events || []).map(
      (event: any) => {
        const eventGenres = event.prtnr_event_genres || [];
        const genres = eventGenres
          .map((eg: any) => eg.prtnr_genres)
          .filter(Boolean);
        const primaryGenre =
          eventGenres.find((eg: any) => eg.classification_primary)
            ?.prtnr_genres || null;

        // Remove the nested prtnr_event_genres from the response
        const { prtnr_event_genres, ...eventData } = event;

        return {
          ...eventData,
          genres,
          primary_genre: primaryGenre,
        };
      }
    );

    const response: ApiResponse<EventWithGenres[]> = {
      source: "database",
      id: numericId,
      city,
      cacheStatus,
      count: eventsWithGenres?.length || 0,
      data: eventsWithGenres || [],
    };

    return res.json(response);
  } catch (error) {
    logger.error({
      msg: "Events endpoint error",
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: "Internal server error",
      message: "An unexpected error occurred",
    });
  }
});

export default router;
