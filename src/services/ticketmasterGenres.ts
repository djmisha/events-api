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
   * Fetch all music genres from Ticketmaster Discovery API
   */
  async fetchMusicGenres(): Promise<
    Array<{ id: string; name: string; segment?: { id: string; name: string } }>
  > {
    if (!this.apiKey) {
      throw new Error("Ticketmaster API key not configured");
    }

    try {
      const url = `${this.baseURL}/classifications.json`;
      const response = await axios.get<TicketmasterGenreResponse>(url, {
        params: {
          apikey: this.apiKey,
          segmentName: "Music",
        },
      });

      const genres = response.data._embedded?.genres || [];
      logger.info(`Fetched ${genres.length} music genres from Ticketmaster`);
      return genres;
    } catch (error) {
      logger.error("Failed to fetch Ticketmaster genres:", {
        message: error instanceof Error ? error.message : "Unknown error",
        status: axios.isAxiosError(error) ? error.response?.status : undefined,
        statusText: axios.isAxiosError(error)
          ? error.response?.statusText
          : undefined,
      });
      throw error;
    }
  }

  /**
   * Extract music-only classifications from event
   */
  // eslint-disable-next-line class-methods-use-this
  extractMusicClassifications(
    classifications: TicketmasterClassification[] = []
  ): TicketmasterClassification[] {
    // eslint-disable-next-line arrow-body-style
    return classifications.filter((c) => {
      return (
        c.segment?.name === "Music" || c.segment?.id === "KZFzniwnSyZfZ7v7nJ"
      );
    });
  }
}

export default new TicketmasterGenresService();
