export interface PartnerEvent {
  id: number;
  source: string;
  name: string;
  venue: {
    id: number | string;
    name: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  location_id: number;
  date: string;
  starttime?: string | null;
  endtime?: string | null;
  link?: string | null;
  image: string | null;
  ages?: string | null;
  festivalind: boolean;
  livestreamind: boolean;
  electronicgenreind: boolean;
  othergenreind: boolean;
  artistList?: Array<{
    id: number;
    name: string;
    link?: string;
  }>;
  artistlist: Array<{
    id: number;
    name: string;
    link?: string;
  }>;
  createddate: string;
  classifications?: TicketmasterClassification[] | null;
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

// Normalized Data Batch Service Types
export interface NormalizedVenue {
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

export interface NormalizedArtist {
  id: number | string;
  name: string;
  link?: string;
}

export interface NormalizedEvent {
  id: number;
  source: string;
  link?: string;
  image?: string | null;
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
  venue?: NormalizedVenue;
  artistlist?: NormalizedArtist[];
}

/**
 * Result of batch upsert operations for normalized partner data
 * Tracks success/failure counts and newly inserted artists for efficient sync
 */
export interface BatchUpsertResult {
  /** Number of successfully upserted records */
  success: number;
  /** Number of failed upsert operations */
  failed: number;
  /** External IDs (source:id) for partner artists newly inserted during this batch */
  newPartnerArtistExternalIds: string[];
}

/**
 * Data source identifier for artist records
 * Used to track which external API the artist originated from
 */
export type ArtistSource = "edmtrain" | "ticketmaster";

/**
 * Master artist record aggregating data from multiple sources
 * This is the complete database representation with all fields
 *
 * Note: External IDs (ticketmaster_id, edmtrain_id) are nullable because
 * an artist may only exist in one source at the time of creation
 */
export interface Artist {
  /** Internal UUID primary key */
  id: string;
  /** Display name of the artist */
  name: string;
  /** URL-friendly identifier (unique, auto-generated from name) */
  slug: string;
  /** URL to artist image/photo */
  image: string | null;
  /** Array of genre/style tags (stored as JSONB in database) */
  tags: string[];
  /** External Ticketmaster attraction ID (nullable - may not exist yet) */
  ticketmaster_id: string | null;
  /** External EDM Train artist ID (nullable - may not exist yet) */
  edmtrain_id: number | null;
  /** Artist biography or description */
  bio: string | null;
  /** Additional metadata stored as key-value pairs */
  metadata: Record<string, unknown>;
  /** Timestamp when record was created */
  created_at: string;
  /** Timestamp when record was last updated (auto-updated by trigger) */
  updated_at: string;
}

/**
 * Input type for creating or updating artists
 * All fields except name are optional for flexible data enrichment
 */
export interface ArtistInput {
  /** Display name (required) */
  name: string;
  /** URL-friendly slug (auto-generated if not provided) */
  slug?: string;
  /** URL to artist image */
  image?: string | null;
  /** Array of genre/style tags */
  tags?: string[];
  /** Ticketmaster attraction ID */
  ticketmaster_id?: string | null;
  /** EDM Train artist ID */
  edmtrain_id?: number | null;
  /** Artist biography */
  bio?: string | null;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result summary from artist sync operations
 * Provides observability into batch sync performance
 */
export interface ArtistSyncResult {
  /** Number of new artist records created */
  created: number;
  /** Number of existing artists updated with new data */
  updated: number;
  /** Number of artists skipped (no changes needed) */
  skipped: number;
  /** Number of artists that failed to sync */
  errors: number;
}

/**
 * API response format for artist endpoints
 * Consistent structure across all artist queries
 */
export interface ArtistApiResponse {
  /** Artist record(s) or null if not found */
  data: Artist | Artist[] | null;
  /** Number of records returned */
  count: number;
  /** Optional human-readable message */
  message?: string;
}
