const logger = require("../services/logger");
const supabase = require("../services/supabaseClient");
const crypto = require("crypto");

const generateNumericIdFromString = (str) => {
  // Create a hash of the string
  const hash = crypto.createHash("md5").update(str).digest("hex");
  // Take first 12 characters and convert from hex to decimal
  const numericId = parseInt(hash.substring(0, 12), 16);
  // Ensure it fits in JavaScript's safe integer range
  return numericId % Number.MAX_SAFE_INTEGER;
};

const normalizeEdmTrainEvents = (events, cityId, cityName) => {
  if (!Array.isArray(events)) {
    logger.warn("EDM Train events is not an array");
    return [];
  }

  return events
    .map((event) => {
      try {
        return {
          id: event.id,
          source: "edmtrain",
          link: event.link || null,
          name: event.name || null,
          ages: event.ages || null,
          festivalind: event.festivalInd || false,
          livestreamind: event.livestreamInd || false,
          electronicgenreind: event.electronicGenreInd || false,
          othergenreind: event.otherGenreInd || false,
          date: event.date || null,
          starttime: event.startTime || null,
          endtime: event.endTime || null,
          createddate: event.createdDate || new Date().toISOString(),
          venue: event.venue || null,
          artistlist: event.artistList || [],
          location_id: cityId,
        };
      } catch (error) {
        logger.error("Error transforming EDM Train event:", error, event);
        return null;
      }
    })
    .filter(Boolean);
};

const normalizeTicketmasterEvents = (events, cityId, cityName) => {
  if (!Array.isArray(events)) {
    logger.warn("Ticketmaster events is not an array");
    return [];
  }

  return events
    .map((event) => {
      try {
        const venue = event._embedded?.venues?.[0];
        const classification = event.classifications?.[0];
        const attractions = event._embedded?.attractions || [];

        return {
          id: generateNumericIdFromString(`ticketmaster_${event.id}`),
          source: "ticketmaster",
          link: event.url ? event.url.replace("sandiegohousemusic", "5926009") : null,
          name: event.name || null,
          ages: event.ageRestrictions?.legalAgeEnforced ? "18+" : null,
          festivalind: false,
          livestreamind: false,
          electronicgenreind:
            classification?.genre?.name?.toLowerCase().includes("electronic") ||
            classification?.genre?.name?.toLowerCase().includes("dance") ||
            false,
          othergenreind: classification?.genre?.name
            ? !(
                classification.genre.name
                  .toLowerCase()
                  .includes("electronic") ||
                classification.genre.name.toLowerCase().includes("dance")
              )
            : false,
          date: event.dates?.start?.localDate || null,
          starttime: event.dates?.start?.localTime || null,
          endtime: null,
          createddate: new Date().toISOString(),
          venue: venue
            ? {
                id: generateNumericIdFromString(venue.id),
                name: venue.name || null,
                location: `${venue.city?.name || ""}, ${
                  venue.state?.stateCode || ""
                }`.trim(),
                address: venue.address?.line1 || null,
                state: venue.state?.name || null,
                country: venue.country?.name || null,
                latitude: venue.location?.latitude
                  ? parseFloat(venue.location.latitude)
                  : null,
                longitude: venue.location?.longitude
                  ? parseFloat(venue.location.longitude)
                  : null,
              }
            : null,
          artistlist: attractions.map((attraction) => ({
            id: parseInt(
              attraction.id?.replace(/[^0-9]/g, "") ||
                Math.floor(Math.random() * 100000)
            ),
            name: attraction.name || null,
            link: attraction.url ? attraction.url.replace("sandiegohousemusic", "5926009") : null,
            b2bInd: false,
          })),
          location_id: cityId,
        };
      } catch (error) {
        logger.error("Error transforming Ticketmaster event:", {
          error: error.message,
          eventId: event?.id,
          eventName: event?.name,
          venue: event._embedded?.venues?.[0]?.name,
          stackTrace: error.stack,
        });
        console.error("Full Ticketmaster Transform Error:", error);
        console.error("Problematic Event Data:", JSON.stringify(event, null, 2));
        return null;
      }
    })
    .filter(Boolean);
};

module.exports = {
  normalizeEdmTrainEvents,
  normalizeTicketmasterEvents,
};
