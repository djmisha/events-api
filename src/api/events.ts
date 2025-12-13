import express, { Request, Response } from "express";
import supabase from "../services/supabaseClient";
import logger from "../services/logger";
import cacheControl from "../services/cacheControl";
import backgroundJobs from "../services/backgroundJobs";
import { ApiResponse, EventWithGenres } from "../types";

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

    // Calculate the date for "yesterday" in UTC
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1); // Go back one day in UTC

    const yesterdayDate = yesterday.toISOString().split("T")[0]; // Format as YYYY-MM-DD

    // Always fetch current data from database first with joins for genres, venues, and artists
    const { data: events, error } = await supabase
      .from("prtnr_events")
      .select(
        `
        *,
        prtnr_venues (
          id,
          name,
          address,
          city,
          state
        ),
        prtnr_event_genres (
          classification_primary,
          prtnr_genres (
            id,
            name,
            normalized_name,
            ticketmaster_genre_id
          )
        ),
        prtnr_event_artists!inner (
          display_order,
          prtnr_artists (
            id,
            name
          )
        )
      `
      )
      .eq("location_id", numericId)
      .gte("date", yesterdayDate) // Include events from yesterday onwards
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

    // Transform events to include genres, venue, and artistlist in a more accessible format
    const eventsWithGenres: EventWithGenres[] = (events || []).map(
      (event: any) => {
        const eventGenres = event.prtnr_event_genres || [];
        const genres = eventGenres
          .map((eg: any) => eg.prtnr_genres)
          .filter(Boolean);
        const primaryGenre =
          eventGenres.find((eg: any) => eg.classification_primary)
            ?.prtnr_genres || null;

        // Transform venue from joined data
        const venue = event.prtnr_venues
          ? {
              name: event.prtnr_venues.name,
              address: event.prtnr_venues.address || undefined,
              city: event.prtnr_venues.city || undefined,
              state: event.prtnr_venues.state || undefined,
            }
          : undefined;

        // Transform artistlist from joined data, sorted by display_order
        const artistlist = (event.prtnr_event_artists || [])
          .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((ea: any) => ea.prtnr_artists)
          .filter(Boolean)
          .map((artist: any) => ({
            id: artist.id,
            name: artist.name,
          }));

        // Remove the nested join tables and venue_id from the response
        const {
          prtnr_event_genres: _genres,
          prtnr_venues: _venues,
          prtnr_event_artists: _artists,
          venue_id: _venueId,
          ...eventData
        } = event;

        return {
          ...eventData,
          venue,
          artistlist,
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
