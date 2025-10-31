import express, { Request, Response } from "express";
import supabase from "../services/supabaseClient";
import logger from "../services/logger";

const router = express.Router();

/**
 * GET /api/genres
 * List all genres
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("prtnr_genres")
      .select("*")
      .order("name");

    if (error) throw error;

    res.json({
      genres: data,
      count: data?.length || 0,
    });
  } catch (error) {
    logger.error("Failed to fetch genres:", error);
    res.status(500).json({ error: "Failed to fetch genres" });
  }
});

/**
 * GET /api/genres/:id/events
 * Get events for a genre
 */
router.get("/:id/events", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("prtnr_event_genres")
      .select(
        `
        event_id,
        prtnr_events (*)
      `
      )
      .eq("genre_id", id);

    if (error) throw error;

    res.json({
      genre_id: id,
      events:
        data?.map((row: { prtnr_events: unknown }) => row.prtnr_events) || [],
      count: data?.length || 0,
    });
  } catch (error) {
    logger.error("Failed to fetch genre events:", error);
    res.status(500).json({ error: "Failed to fetch genre events" });
  }
});

/**
 * GET /api/genres/stats
 * Genre statistics
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const stats = {
      total_genres: 0,
      total_mappings: 0,
      events_with_genres: 0,
      events_without_genres: 0,
    };

    // Count genres
    const { count: genreCount } = await supabase
      .from("prtnr_genres")
      .select("*", { count: "exact", head: true });
    stats.total_genres = genreCount || 0;

    // Count mappings
    const { count: mappingCount } = await supabase
      .from("prtnr_event_genres")
      .select("*", { count: "exact", head: true });
    stats.total_mappings = mappingCount || 0;

    res.json(stats);
  } catch (error) {
    logger.error("Failed to fetch genre stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
