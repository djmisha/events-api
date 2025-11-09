import axios from "axios";
import logger from "./logger";

interface TicketmasterEvent {
  id: string;
  name: string;
  dates: {
    start: {
      localDate: string;
      localTime?: string;
    };
  };
  _embedded?: {
    venues?: Array<{
      name: string;
      address?: {
        line1?: string;
      };
      city?: {
        name?: string;
      };
      state?: {
        stateCode?: string;
      };
    }>;
    attractions?: Array<{
      id: string;
      name: string;
      url?: string;
    }>;
  };
  url?: string;
  images?: Array<{
    url: string;
  }>;
  classifications?: Array<{
    primary?: boolean;
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
}

class TicketmasterService {
  private apiKey: string | undefined;
  private baseURL: string | undefined;
  private url: string;

  constructor() {
    this.apiKey = process.env.TICKETMASTER_API_KEY;
    this.baseURL = process.env.TICKETMASTER_API_URL;
    this.url = `${this.baseURL}apikey=${this.apiKey}&city=`;

    if (!this.apiKey) {
      logger.warn("Ticketmaster API key not configured");
    }
  }

  async fetchEvents(
    cityId: number,
    cityName: string
  ): Promise<TicketmasterEvent[]> {
    try {
      const cityForTicketmaster = cityName.replace(/-/g, " ");
      // Add segmentId=KZFzniwnSyZfZ7v7nJ (Music) to filter only music events
      const requestUrl = `${this.url}${encodeURIComponent(cityForTicketmaster)}&segmentId=KZFzniwnSyZfZ7v7nJ`;
      const response = await axios.get(requestUrl);

      if (
        response.data &&
        response.data._embedded &&
        response.data._embedded.events
      ) {
        const { events } = response.data._embedded;
        logger.info(
          `Ticketmaster returned ${events.length} events for city: ${cityName}`
        );
        return events;
      }
      logger.info(`No Ticketmaster events found for city: ${cityName}`);

      return [];
    } catch (error) {
      logger.error(`Ticketmaster API error for city: ${cityName}`, {
        message: error instanceof Error ? error.message : "Unknown error",
        status: axios.isAxiosError(error) ? error.response?.status : undefined,
        statusText: axios.isAxiosError(error)
          ? error.response?.statusText
          : undefined,
        data: axios.isAxiosError(error) ? error.response?.data : undefined,
        url: `${this.url}${encodeURIComponent(cityName)}`,
      });
      throw error;
    }
  }
}

export default new TicketmasterService();
