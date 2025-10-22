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
  starttime?: string;
  endtime?: string;
  link?: string;
  ages?: string;
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
