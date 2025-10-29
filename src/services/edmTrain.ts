import axios from "axios";
import logger from "./logger";

interface EdmTrainEvent {
  id: string;
  name: string;
  venue: {
    name: string;
    address?: string;
  };
  date: string;
  startTime?: string;
  endTime?: string;
  link?: string;
  ages?: string;
  artistList?: Array<{
    id: string;
    name: string;
  }>;
  electronicgenreind?: boolean; // Flag from EDM Train API (false = not electronic music)
}

class EdmTrainService {
  private apiKey: string | undefined;
  private baseURL: string | undefined;

  constructor() {
    this.apiKey = process.env.EDM_TRAIN_API_KEY;
    this.baseURL = process.env.EDM_TRAIN_API_URL;

    if (!this.apiKey) {
      logger.warn("EDM Train API key not configured");
    }
  }

  async fetchEvents(
    cityId: number,
    cityName: string
  ): Promise<EdmTrainEvent[]> {
    if (!this.apiKey) {
      logger.warn("EDM Train API key not available, skipping fetch");
      return [];
    }

    try {
      const url = `${this.baseURL}${cityId}&client=${this.apiKey}`;
      const response = await axios.get(url);

      if (response.data && response.data.data) {
        logger.info(
          `EDM Train returned ${response.data.data.length} events for city: ${cityName} (ID: ${cityId})`
        );
        return response.data.data;
      }

      return [];
    } catch (error) {
      logger.error(
        `EDM Train API error for city: ${cityName} (ID: ${cityId})`,
        {
          message: error instanceof Error ? error.message : "Unknown error",
          status: axios.isAxiosError(error)
            ? error.response?.status
            : undefined,
          statusText: axios.isAxiosError(error)
            ? error.response?.statusText
            : undefined,
        }
      );
      throw error;
    }
  }
}

export default new EdmTrainService();
