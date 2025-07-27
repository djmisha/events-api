const axios = require("axios");
const logger = require("./logger");

class TicketmasterService {
  constructor() {
    this.apiKey = process.env.TICKETMASTER_API_KEY;
    this.baseURL = process.env.TICKETMASTER_API_URL;
    this.genreId = "KnvZfZ7vAvF"; // Dance / Electronic genreId
    this.url = `${this.baseURL}apikey=${this.apiKey}&genreId=${this.genreId}&city=`;

    if (!this.apiKey) {
      logger.warn("Ticketmaster API key not configured");
    }
  }

  async fetchEvents(cityName) {
    // Note: Ticketmaster doesn't require API key for basic searches, but it's recommended

    try {
      logger.info(`Fetching Ticketmaster events for city: ${cityName}`);

      const response = await axios.get(
        `${this.url}${encodeURIComponent(cityName)}`
      );

      if (
        response.data &&
        response.data._embedded &&
        response.data._embedded.events
      ) {
        const events = response.data._embedded.events;
        logger.info(
          `Ticketmaster returned ${events.length} events for city: ${cityName}`
        );
        return events;
      }

      return [];
    } catch (error) {
      logger.error(`Ticketmaster API error for city: ${cityName}`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
      throw error;
    }
  }
}

module.exports = new TicketmasterService();
