const logger = require("../services/logger");
const supabase = require("../services/supabaseClient");
const crypto = require("crypto");

const generateNumericIdFromString = (str, source = "ticketmaster") => {
  // Create a hash of the string with source prefix
  const prefixedStr = `${source}_${str}`;
  const hash = crypto.createHash("md5").update(prefixedStr).digest("hex");
  // Take first 12 characters and convert from hex to decimal
  let numericId = parseInt(hash.substring(0, 12), 16);

  // Add source-specific offset to prevent collisions with EDM Train IDs
  if (source === "ticketmaster") {
    // Start Ticketmaster IDs from a high number to avoid EDM Train collisions
    // EDM Train IDs appear to be in the 400k range, so use 1 billion offset
    numericId = (numericId % 1000000000) + 1000000000;
  }

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
        logger.error("Error transforming EDM Train event:", {
          error: error.message,
          eventId: event?.id,
        });
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
          id: generateNumericIdFromString(event.id, "ticketmaster"),
          source: "ticketmaster",
          link: event.url
            ? event.url.replace("sandiegohousemusic", "5926009")
            : null,
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
                id: generateNumericIdFromString(venue.id, "ticketmaster_venue"),
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
            link: attraction.url
              ? attraction.url.replace("sandiegohousemusic", "5926009")
              : null,
            b2bInd: false,
          })),
          location_id: cityId,
        };
      } catch (error) {
        logger.error("Error transforming Ticketmaster event:", {
          error: error.message,
          eventId: event?.id,
          eventName: event?.name,
        });
        return null;
      }
    })
    .filter(Boolean);
};

module.exports = {
  normalizeEdmTrainEvents,
  normalizeTicketmasterEvents,
};
