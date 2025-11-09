import crypto from "crypto";
import logger from "../services/logger";
import { PartnerEvent } from "../types";

/**
 * Normalizes an array of EDM Train events into PartnerEvent objects, filtering for electronic music
 * and handling errors.
 * @param events - The raw array of EDM Train event data.
 * @param cityId - The numeric ID of the city for location association.
 * @returns An array of normalized PartnerEvent objects.
 */
const normalizeEdmTrainEvents = (
  events: any[],
  cityId: number
): PartnerEvent[] => {
  if (!Array.isArray(events)) {
    logger.warn("EDM Train events is not an array");
    return [];
  }

  return events
    .map((event): PartnerEvent | null => {
      try {
        const {
          festivalInd,
          livestreamInd,
          electronicGenreInd,
          otherGenreInd,
        } = event;

        return {
          id: parseInt(event.id, 10) || 0,
          source: "edmtrain",
          name: event.name || "",
          venue: {
            id: event.venue?.id || `edmtrain-venue-${event.venue?.name}`,
            name: event.venue?.name || "",
            city: event.venue?.location?.split(",")[0]?.trim() || "",
            address: event.venue?.address,
            state: event.venue?.state,
            country: event.venue?.country,
            latitude: event.venue?.latitude,
            longitude: event.venue?.longitude,
          },
          location_id: cityId,
          date: event.date || new Date().toISOString().split("T")[0],
          starttime: event.startTime || null,
          endtime: event.endTime || null,
          link: event.link || null,
          image: generateEDMtrainImageURL(event),
          ages: event.ages || null,
          festivalind: festivalInd,
          livestreamind: livestreamInd,
          electronicgenreind: electronicGenreInd,
          othergenreind: otherGenreInd,
          artistlist:
            event.artistList?.map((artist: any) => ({
              id: parseInt(artist.id, 10) || 0,
              name: artist.name || "",
              link: undefined,
            })) || [],
          createddate: new Date().toISOString(),
        };
      } catch (error) {
        logger.error("Error transforming EDM Train event:", error);
        return null;
      }
    })
    .filter((event): event is PartnerEvent => event !== null);
};

/**
 * Normalizes an array of Ticketmaster events into PartnerEvent objects,
 * handling venue and attraction
 * data.
 * @param events - The raw array of Ticketmaster event data.
 * @param cityId - The numeric ID of the city for location association.
 * @returns An array of normalized PartnerEvent objects.
 */
const normalizeTicketmasterEvents = (
  events: any[],
  cityId: number
): PartnerEvent[] => {
  if (!Array.isArray(events)) {
    logger.warn("Ticketmaster events is not an array");
    return [];
  }

  return events
    .map((event): PartnerEvent | null => {
      try {
        const venue = event._embedded?.venues?.[0];
        const attractions = event._embedded?.attractions || [];

        return {
          id: generateNumericIdFromString(event.id, "ticketmaster"),
          source: "ticketmaster",
          name: event.name || "",
          venue: {
            id: venue?.id || `ticketmaster-venue-${venue?.name}`,
            name: venue?.name || "",
            address: venue?.address?.line1,
            city: venue?.city?.name,
            state: venue?.state?.name,
            country: venue?.country?.name,
            latitude: venue?.location?.latitude
              ? parseFloat(venue.location.latitude)
              : undefined,
            longitude: venue?.location?.longitude
              ? parseFloat(venue.location.longitude)
              : undefined,
          },
          location_id: cityId,
          date:
            event.dates?.start?.localDate ||
            new Date().toISOString().split("T")[0],
          starttime: event.dates?.start?.localTime || null,
          endtime: null,
          link: event.url?.replace("sandiegohousemusic", "5926009") || null,
          image: generateTicketmasterImageURL(event),
          ages: null,
          festivalind: false,
          livestreamind: false,
          electronicgenreind: false,
          othergenreind: false,
          artistlist: attractions.map((attraction: any) => ({
            id: generateNumericIdFromString(
              attraction.id || `unknown-artist-${attraction.name}-${Math.random()}`,
              "ticketmaster-artist"
            ),
            name: attraction.name || "",
            link:
              attraction.url?.replace("sandiegohousemusic", "5926009") ||
              undefined,
          })),
          createddate: new Date().toISOString(),
          classifications: event.classifications || null,
        };
      } catch (error) {
        logger.error("Error transforming Ticketmaster event:", error);
        return null;
      }
    })
    .filter((event): event is PartnerEvent => event !== null);
};

/**
 * Generates a URL for the first artist's image in the artistlist array.
 * The URL format is: https://www.grooverooster.com/images/artists/{artistId}.jpg
 * @param event - The PartnerEvent object containing the artistlist.
 * @returns The generated image URL string or null if no artist is available.
 */
const generateEDMtrainImageURL = (event: PartnerEvent): string | null => {
  if (event.artistList && event.artistList.length > 0) {
    const artistId = event.artistList[0].id;
    return `https://www.grooverooster.com/images/artists/${artistId}.jpg`;
  }
  return null;
};

/**
 * Generates an image URL for a Ticketmaster event, prioritizing the event's own images or falling
 * back to the first attraction's images.
 * @param event - The raw Ticketmaster event object.
 * @returns The image URL string or null if no image is available.
 */
const generateTicketmasterImageURL = (event: any): string | null => {
  // First, try to get image from the event's own images array
  if (event.images && event.images.length > 1) {
    return event.images[1].url;
  }
  // Fallback: try to get image from the first attraction's images array
  if (
    event._embedded?.attractions?.[0]?.images &&
    event._embedded.attractions[0].images.length > 0
  ) {
    return event._embedded.attractions[0].images[2].url;
  }
  return null;
};

/**
 * Generates a numeric ID from a string using MD5 hashing, with source-specific offsets to prevent
 * collisions.
 * @param str - The input string to hash.
 * @param source - The source identifier (default: "ticketmaster") to prefix the string and apply
 * offsets.
 * @returns A numeric ID within JavaScript's safe integer range.
 */
const generateNumericIdFromString = (
  str: string,
  source = "ticketmaster"
): number => {
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

export default {
  normalizeEdmTrainEvents,
  normalizeTicketmasterEvents,
  generateNumericIdFromString,
};
