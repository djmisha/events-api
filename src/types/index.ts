export interface PartnerEvent {
  id: number;
  source: string;
  name: string;
  venue: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
  };
  location_id: number;
  date: string;
  starttime?: string | null;
  endtime?: string | null;
  link?: string | null;
  ages?: string | null;
  festivalind: boolean;
  livestreamind: boolean;
  electronicgenreind: boolean;
  othergenreind: boolean;
  artistlist: Array<{
    id: number;
    name: string;
    link?: string;
  }>;
  createddate: string;
}

export interface CacheControl {
  location_id: string;
  last_update: string;
  next_update: string;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  data: T;
  source: string;
  id: number;
  city: string;
  cacheStatus: "fresh" | "stale";
  count: number;
}

// Genre-related types
export interface Genre {
  id: string; // UUID
  name: string;
  normalized_name: string | null;
  ticketmaster_genre_id: string | null;
  ticketmaster_segment_id: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GenreSubgenre {
  id: string; // UUID
  genre_id: string; // UUID
  name: string;
  normalized_name: string | null;
  ticketmaster_subgenre_id: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EventGenre {
  id: string; // UUID
  event_id: number; // BIGINT
  genre_id: string; // UUID
  classification_primary: boolean;
  ticketmaster_classification_json: Record<string, unknown> | null;
  created_at: string;
}

// Ticketmaster API types
export interface TicketmasterClassification {
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
  type?: {
    id: string;
    name: string;
  };
  subType?: {
    id: string;
    name: string;
  };
}

// Extended event type with genres
export interface EventWithGenres extends PartnerEvent {
  genres?: Genre[];
  primary_genre?: Genre | null;
}
