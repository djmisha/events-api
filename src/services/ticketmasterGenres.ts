/**
 * Ticketmaster Genres Service
 *
 * Handles fetching and processing genre data from Ticketmaster API.
 *
 * Operations:
 * - Bootstrap: Fetch initial genres by sampling events from Ticketmaster
 * - Extract: Filter classifications to music-only segments
 *
 * Database Operations:
 * - Used during initial bootstrap (npm run genres:bootstrap)
 * - Samples 200 events to extract unique music genres
 * - Returns genre list for insertion into prtnr_genres table
 *
 * Note: After bootstrap, genres are created dynamically during webhook runs
 * via fetchPartnerData job, so this service is mainly used for initial setup.
 */

import axios from "axios";
import logger from "./logger";
import { TicketmasterClassification } from "../types";

interface TicketmasterGenreResponse {
  _embedded?: {
    genres?: Array<{
      id: string;
      name: string;
      segment?: {
        id: string;
        name: string;
      };
    }>;
    events?: Array<{
      id: string;
      name: string;
      classifications?: Array<{
        segment?: {
          id: string;
          name: string;
        };
        genre?: {
          id: string;
          name: string;
        };
        subGenre?: {
          id: string;
          name: string;
        };
      }>;
    }>;
  };
  _links?: unknown;
  page?: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

class TicketmasterGenresService {
  private apiKey: string | undefined;
  private baseURL: string;

  constructor() {
    this.apiKey = process.env.TICKETMASTER_API_KEY;
    this.baseURL = "https://app.ticketmaster.com/discovery/v2";

    if (!this.apiKey) {
      logger.warn("Ticketmaster API key not configured for genres service");
    }
  }

  /**
   * Fetch music genres from Ticketmaster by extracting from event classifications.
   */
  async fetchMusicGenres(): Promise<
    Array<{ id: string; name: string; segment?: { id: string; name: string } }>
  > {
    if (!this.apiKey) {
      throw new Error("Ticketmaster API key not configured");
    }

    try {
      const url = `${this.baseURL}/events`;
      const response = await axios.get<TicketmasterGenreResponse>(url, {
        params: {
          apikey: this.apiKey,
          segmentId: "KZFzniwnSyZfZ7v7nJ",
          size: 200,
          classificationName: "music",
        },
      });

      const events = response.data._embedded?.events || [];

      type GenreData = {
        id: string;
        name: string;
        segment?: { id: string; name: string };
      };
      const genreMap = new Map<string, GenreData>();

      events.forEach((event: any) => {
        const classifications = event.classifications || [];
        classifications.forEach((classification: any) => {
          if (
            classification.genre?.id &&
            classification.genre?.name &&
            (classification.segment?.id === "KZFzniwnSyZfZ7v7nJ" ||
              classification.segment?.name === "Music")
          ) {
            genreMap.set(classification.genre.id, {
              id: classification.genre.id,
              name: classification.genre.name,
              segment: classification.segment,
            });
          }
        });
      });

      const musicGenres = Array.from(genreMap.values());

      logger.info(
        `Extracted ${musicGenres.length} unique music genres from ${events.length} Ticketmaster events`
      );
      return musicGenres;
    } catch (error) {
      logger.error("Failed to fetch Ticketmaster genres:", {
        message: error instanceof Error ? error.message : "Unknown error",
        status: axios.isAxiosError(error) ? error.response?.status : undefined,
        statusText: axios.isAxiosError(error)
          ? error.response?.statusText
          : undefined,
        data: axios.isAxiosError(error) ? error.response?.data : undefined,
      });
      throw error;
    }
  }

  /**
   * Filter classifications to include only music segment events.
   */
  static extractMusicClassifications(
    classifications: TicketmasterClassification[] = []
  ): TicketmasterClassification[] {
    return classifications.filter((c) => {
      const isMusic = c.segment?.name === "Music";
      const isMusicSegment = c.segment?.id === "KZFzniwnSyZfZ7v7nJ";
      return isMusic || isMusicSegment;
    });
  }
}

export default new TicketmasterGenresService();
