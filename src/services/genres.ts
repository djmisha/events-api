/**
 * Genre Service
 *
 * Handles genre-related database operations including:
 * - Upserting genres from Ticketmaster API
 * - Fetching genre lists with optional filters
 * - Mapping events to genres via classifications
 *
 * Database Operations:
 * - Uses upsert for idempotent genre creation
 * - Batch operations where possible for performance
 * - Automatic normalization of genre names for URL slugs
 */

import supabase from "./supabaseClient";
import logger from "./logger";
import { Genre, TicketmasterClassification } from "../types";

/**
 * Normalize genre name to slug format
 */
function normalizeGenreName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

class GenreService {
  /**
   * Upsert a genre by Ticketmaster genre ID
   */
  // eslint-disable-next-line class-methods-use-this
  async upsertGenre(data: {
    name: string;
    ticketmaster_genre_id: string;
    ticketmaster_segment_id: string | null;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ genre: Genre; created: boolean }> {
    const normalizedName = normalizeGenreName(data.name);

    // Try to find existing genre by TM ID
    const { data: existing, error: selectError } = await supabase
      .from("prtnr_genres")
      .select("*")
      .eq("ticketmaster_genre_id", data.ticketmaster_genre_id)
      .maybeSingle();

    if (selectError) {
      logger.error("Failed to check existing genre:", selectError);
      throw selectError;
    }

    if (existing) {
      // Update existing genre
      const { data: updated, error: updateError } = await supabase
        .from("prtnr_genres")
        .update({
          name: data.name,
          normalized_name: normalizedName,
          ticketmaster_segment_id: data.ticketmaster_segment_id,
          description: data.description,
          metadata: data.metadata,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError) {
        logger.error("Failed to update genre:", updateError);
        throw updateError;
      }

      return { genre: updated as Genre, created: false };
    }

    // Insert new genre
    const { data: inserted, error: insertError } = await supabase
      .from("prtnr_genres")
      .insert({
        name: data.name,
        normalized_name: normalizedName,
        ticketmaster_genre_id: data.ticketmaster_genre_id,
        ticketmaster_segment_id: data.ticketmaster_segment_id,
        description: data.description,
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to insert genre:", insertError);
      throw insertError;
    }

    return { genre: inserted as Genre, created: true };
  }

  /**
   * Map event to genres based on classifications
   */
  /* eslint-disable no-restricted-syntax, no-continue, class-methods-use-this */
  async mapEventGenres(
    eventId: number,
    classifications: TicketmasterClassification[]
  ): Promise<void> {
    for (const classification of classifications) {
      if (!classification.genre?.id) {
        continue;
      }

      // Find genre by TM ID
      const { data: genre, error: genreError } = await supabase
        .from("prtnr_genres")
        .select("id")
        .eq("ticketmaster_genre_id", classification.genre.id)
        .maybeSingle();

      if (genreError) {
        logger.error("Error finding genre:", genreError);
        continue;
      }

      if (!genre) {
        logger.warn(
          `Genre not found for TM ID ${classification.genre.id}, will be created on next bootstrap`
        );
        continue;
      }

      // Upsert event-genre mapping
      const { error: mappingError } = await supabase
        .from("prtnr_event_genres")
        .upsert(
          {
            event_id: eventId,
            genre_id: genre.id,
            classification_primary: classification.primary || false,
            ticketmaster_classification_json: classification,
          },
          {
            onConflict: "event_id,genre_id",
          }
        );

      if (mappingError) {
        logger.error("Failed to map event to genre:", mappingError);
        throw mappingError;
      }
    }
  }
  /* eslint-enable no-restricted-syntax, no-continue, class-methods-use-this */

  /**
   * Get genres for an event
   */
  // eslint-disable-next-line class-methods-use-this
  async getEventGenres(eventId: number): Promise<Genre[]> {
    const { data, error } = await supabase
      .from("prtnr_event_genres")
      .select(
        `
        genre_id,
        prtnr_genres (*)
      `
      )
      .eq("event_id", eventId)
      .order("classification_primary", { ascending: false });

    if (error) {
      logger.error("Failed to fetch event genres:", error);
      throw error;
    }

    if (!data) return [];

    // Extract genres from joined data
    return data
      .map((row: Record<string, unknown>) => row.prtnr_genres as Genre | null)
      .filter((g): g is Genre => g !== null);
  }
}

export default new GenreService();
