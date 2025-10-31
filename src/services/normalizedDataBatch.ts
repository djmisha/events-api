/**
 * Optimized Batch Normalized Data Service
 * High-performance batch operations for serverless environments
 */

import supabase from "./supabaseClient";
import logger from "./logger";

interface Venue {
  id: number | string;
  name: string;
  city?: string;
  location?: string;
  state?: string;
  country?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

interface Artist {
  id: number | string;
  name: string;
  link?: string;
}

interface Event {
  id: number;
  source: string;
  link?: string;
  name: string;
  ages?: string;
  festivalind: boolean;
  livestreamind: boolean;
  electronicgenreind: boolean;
  othergenreind: boolean;
  date: string;
  starttime?: string;
  endtime?: string;
  createddate: string;
  location_id: number;
  venue?: Venue;
  artistlist?: Artist[];
}

function generateExternalId(
  source: string,
  originalId: number | string
): string | null {
  if (!originalId) return null;
  return `${source}:${originalId}`;
}

async function batchUpsertVenues(
  venues: Venue[],
  source: string
): Promise<Map<string, string>> {
  if (!venues || venues.length === 0) return new Map();

  const venueRecords = venues.map((v) => ({
    external_id: generateExternalId(source, v.id),
    name: v.name,
    city: v.city || v.location?.split(",")[0]?.trim() || null,
    state: v.state || null,
    country: v.country || null,
    address: v.address || null,
    latitude: v.latitude || null,
    longitude: v.longitude || null,
    metadata: v,
  }));

  const externalIds = venueRecords.map((v) => v.external_id);

  const { data: existing } = await supabase
    .from("prtnr_venues")
    .select("id, external_id")
    .in("external_id", externalIds);

  const existingMap = new Map<string, string>();
  existing?.forEach((v) => existingMap.set(v.external_id, v.id));

  const newVenues = venueRecords.filter(
    (v) => !existingMap.has(v.external_id as string)
  );

  if (newVenues.length > 0) {
    const { data: inserted, error } = await supabase
      .from("prtnr_venues")
      .insert(newVenues)
      .select("id, external_id");

    if (error && error.code === "23505") {
      const { data: refetch } = await supabase
        .from("prtnr_venues")
        .select("id, external_id")
        .in("external_id", externalIds);
      refetch?.forEach((v) => existingMap.set(v.external_id, v.id));
      logger.warn(
        `Race condition detected inserting venues, refetched successfully`
      );
    } else if (error) {
      logger.error({
        msg: "Batch venue insert failed",
        error: error.message,
        code: error.code,
      });
    } else {
      inserted?.forEach((v) => existingMap.set(v.external_id, v.id));
    }
  }

  return existingMap;
}

async function batchUpsertArtists(
  artists: Artist[],
  source: string
): Promise<Map<string, string>> {
  if (!artists || artists.length === 0) return new Map();

  const artistRecords = artists.map((a) => ({
    external_id: generateExternalId(source, a.id),
    name: a.name,
    metadata: a,
  }));

  const externalIds = artistRecords.map((a) => a.external_id);

  const { data: existing } = await supabase
    .from("prtnr_artists")
    .select("id, external_id")
    .in("external_id", externalIds);

  const existingMap = new Map<string, string>();
  existing?.forEach((a) => existingMap.set(a.external_id, a.id));

  const newArtists = artistRecords.filter(
    (a) => !existingMap.has(a.external_id as string)
  );

  if (newArtists.length > 0) {
    const { data: inserted, error } = await supabase
      .from("prtnr_artists")
      .insert(newArtists)
      .select("id, external_id");

    if (error && error.code === "23505") {
      const { data: refetch } = await supabase
        .from("prtnr_artists")
        .select("id, external_id")
        .in("external_id", externalIds);
      refetch?.forEach((a) => existingMap.set(a.external_id, a.id));
      logger.warn(
        `Race condition detected inserting artists, refetched successfully`
      );
    } else if (error) {
      logger.error({
        msg: "Batch artist insert failed",
        error: error.message,
        code: error.code,
      });
    } else {
      inserted?.forEach((a) => existingMap.set(a.external_id, a.id));
    }
  }

  return existingMap;
}

async function upsertEventsWithRelations(
  events: Event[],
  source: string
): Promise<{ success: number; failed: number }> {
  if (!Array.isArray(events) || events.length === 0) {
    return { success: 0, failed: events.length };
  }

  const uniqueVenues = new Map<string, Venue>();
  const uniqueArtists = new Map<string, Artist>();

  events.forEach((event) => {
    if (event.venue?.id) {
      const venueKey = generateExternalId(source, event.venue.id);
      if (venueKey && !uniqueVenues.has(venueKey)) {
        uniqueVenues.set(venueKey, event.venue);
      }
    }

    event.artistlist?.forEach((artist) => {
      if (artist?.id) {
        const artistKey = generateExternalId(source, artist.id);
        if (artistKey && !uniqueArtists.has(artistKey)) {
          uniqueArtists.set(artistKey, artist);
        }
      }
    });
  });

  const venueIdMap = await batchUpsertVenues(
    Array.from(uniqueVenues.values()),
    source
  );
  const artistIdMap = await batchUpsertArtists(
    Array.from(uniqueArtists.values()),
    source
  );

  const eventDataList: any[] = [];
  const eventArtistMappings: any[] = [];

  events.forEach((event) => {
    const venueKey = event.venue?.id
      ? generateExternalId(source, event.venue.id)
      : null;
    const venueId = venueKey ? venueIdMap.get(venueKey) : null;

    eventDataList.push({
      id: event.id,
      source: event.source,
      link: event.link,
      name: event.name,
      ages: event.ages,
      festivalind: event.festivalind,
      livestreamind: event.livestreamind,
      electronicgenreind: event.electronicgenreind,
      othergenreind: event.othergenreind,
      date: event.date,
      starttime: event.starttime,
      endtime: event.endtime,
      createddate: event.createddate,
      location_id: event.location_id,
      venue_id: venueId,
    });

    const seenArtists = new Set<string>();
    event.artistlist?.forEach((artist) => {
      if (artist?.id) {
        const artistKey = generateExternalId(source, artist.id);
        const artistId = artistKey ? artistIdMap.get(artistKey) : null;
        if (artistId && !seenArtists.has(artistId)) {
          seenArtists.add(artistId);
          eventArtistMappings.push({
            event_id: event.id,
            artist_id: artistId,
            display_order: seenArtists.size - 1,
          });
        }
      }
    });
  });

  const { error: eventsError } = await supabase
    .from("prtnr_events")
    .upsert(eventDataList, { onConflict: "id" });

  if (eventsError) {
    logger.error({
      msg: "Batch event upsert failed",
      error: eventsError.message,
      code: eventsError.code,
      count: eventDataList.length,
    });
    return { success: 0, failed: events.length };
  }

  const eventIds = events.map((e) => e.id);
  await supabase.from("prtnr_event_artists").delete().in("event_id", eventIds);

  if (eventArtistMappings.length > 0) {
    const { error: mappingsError } = await supabase
      .from("prtnr_event_artists")
      .insert(eventArtistMappings);

    if (mappingsError) {
      logger.error({
        msg: "Batch artist mapping insert failed",
        error: mappingsError.message,
        code: mappingsError.code,
        count: eventArtistMappings.length,
      });
    }
  }

  return { success: events.length, failed: 0 };
}

async function getEventsWithRelations(locationId: number): Promise<any[]> {
  try {
    const { data: events, error: eventsError } = await supabase
      .from("prtnr_events")
      .select("*, venue:prtnr_venues(*)")
      .eq("location_id", locationId)
      .order("date", { ascending: true });

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) return [];

    const eventIds = events.map((e) => e.id);
    const { data: artistMappings, error: mappingsError } = await supabase
      .from("prtnr_event_artists")
      .select("event_id, display_order, artist:prtnr_artists(*)")
      .in("event_id", eventIds)
      .order("display_order", { ascending: true });

    if (mappingsError) {
      logger.error({
        msg: "Failed to fetch artist mappings",
        error: mappingsError.message,
      });
    }

    const artistsByEvent: Record<number, any[]> = {};
    artistMappings?.forEach((mapping) => {
      if (!artistsByEvent[mapping.event_id]) {
        artistsByEvent[mapping.event_id] = [];
      }
      artistsByEvent[mapping.event_id].push(mapping.artist);
    });

    return events.map((event) => ({
      ...event,
      artists: artistsByEvent[event.id] || [],
    }));
  } catch (error: any) {
    logger.error({
      msg: "Failed to fetch events with relations",
      error: error.message,
    });
    throw error;
  }
}

export {
  upsertEventsWithRelations,
  getEventsWithRelations,
  generateExternalId,
};
