/** The fixed home bases that ship with the data (drive times are precomputed). */
export type OriginId = 'kingston' | 'scranton' | 'canadensis';

/** Sentinel origin id for the user's live geolocation. */
export const MY_LOCATION_ID = 'me';
export type MyLocationId = typeof MY_LOCATION_ID;

/** Any origin the user can sort by: a fixed base or their own location. */
export type SelectedOrigin = OriginId | MyLocationId;

export interface Origin {
  id: OriginId;
  label: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Google Maps BusinessStatus, narrowed to the two "closed" states we record.
 * An operational (or unknown) place has `null`.
 */
export type BusinessStatus = 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';

export interface Outing {
  name: string;
  times: Record<OriginId, number | null>;
  map: string;
  website: string | null;
  notes: string;
  coordinates: Coordinates | null;
  address: string | null;
  status: BusinessStatus | null;
}

export interface Category {
  name: string;
  items: Outing[];
}

export interface OutingsData {
  origins: Origin[];
  categories: Category[];
}
