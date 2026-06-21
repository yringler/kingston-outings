export type OriginId = 'kingston' | 'scranton' | 'canadensis';

export interface Origin {
  id: OriginId;
  label: string;
}

export interface Outing {
  name: string;
  times: Record<OriginId, number | null>;
  map: string;
  website: string | null;
  notes: string;
}

export interface Category {
  name: string;
  items: Outing[];
}

export interface OutingsData {
  origins: Origin[];
  categories: Category[];
}
