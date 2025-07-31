const axios = require("axios");
const logger = require("./logger");

class EdmTrainService {
  constructor() {
    this.apiKey = process.env.EDM_TRAIN_API_KEY;
    this.baseURL = process.env.EDM_TRAIN_API_URL;

    if (!this.apiKey) {
      logger.warn("EDM Train API key not configured");
    }
  }

  async fetchEvents(cityId, cityName) {
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
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
        }
      );
      throw error;
    }
  }
}

module.exports = new EdmTrainService();
