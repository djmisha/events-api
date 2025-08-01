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
    if (cityName === "null") return []; // Handle null city case state ID is passed

    try {
      const cityForTicketmaster = cityName.replace(/-/g, " ");
      const requestUrl = `${this.url}${encodeURIComponent(
        cityForTicketmaster
      )}`;
      const response = await axios.get(requestUrl);

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
      } else {
        logger.info(`No Ticketmaster events found for city: ${cityName}`);
      }

      return [];
    } catch (error) {
      logger.error(`Ticketmaster API error for city: ${cityName}`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: `${this.url}${encodeURIComponent(cityName)}`,
      });
      throw error;
    }
  }
}

module.exports = new TicketmasterService();
