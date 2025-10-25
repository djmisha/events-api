import crypto from "crypto";
import logger from "../services/logger";
import { PartnerEvent } from "../types";

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
        return {
          id: parseInt(event.id, 10) || 0,
          source: "edmtrain",
          name: event.name || "",
          venue: {
            name: event.venue?.name || "",
            address: event.venue?.address,
          },
          location_id: cityId,
          date: event.date || new Date().toISOString().split("T")[0],
          starttime: event.startTime || null,
          endtime: event.endTime || null,
          link: event.link || null,
          ages: event.ages || null,
          festivalind: false,
          livestreamind: false,
          electronicgenreind: true,
          othergenreind: false,
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
            name: venue?.name || "",
            address: venue?.address?.line1,
            city: venue?.city?.name,
            state: venue?.state?.stateCode,
          },
          location_id: cityId,
          date:
            event.dates?.start?.localDate ||
            new Date().toISOString().split("T")[0],
          starttime: event.dates?.start?.localTime || null,
          endtime: null,
          link: event.url?.replace("sandiegohousemusic", "5926009") || null,
          ages: null,
          festivalind: false,
          livestreamind: false,
          electronicgenreind: true,
          othergenreind: false,
          artistlist: attractions.map((attraction: any) => ({
            id: parseInt(
              attraction.id?.replace(/[^0-9]/g, "") ||
                Math.floor(Math.random() * 100000),
              10
            ),
            name: attraction.name || "",
            link:
              attraction.url?.replace("sandiegohousemusic", "5926009") ||
              undefined,
          })),
          createddate: new Date().toISOString(),
        };
      } catch (error) {
        logger.error("Error transforming Ticketmaster event:", error);
        return null;
      }
    })
    .filter((event): event is PartnerEvent => event !== null);
};

export default {
  normalizeEdmTrainEvents,
  normalizeTicketmasterEvents,
  generateNumericIdFromString,
};
