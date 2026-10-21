/** Shared TypeScript types matching the Supabase schema in supabase/schema.sql */

export type VenueType = 'house' | 'club';

/** One media item attached to a party (stored in parties.media jsonb). */
export interface PartyMedia {
  url: string;
  type: 'image' | 'video';
}

/** Safely parse the parties.media jsonb value into PartyMedia[]. */
export function parsePartyMedia(value: unknown): PartyMedia[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (m): m is PartyMedia =>
      !!m &&
      typeof m === 'object' &&
      typeof (m as PartyMedia).url === 'string' &&
      ((m as PartyMedia).type === 'image' || (m as PartyMedia).type === 'video')
  );
}

export interface Party {
  id: string;
  organizer_id: string;
  title: string;
  description: string | null;
  venue_type: VenueType;
  /** Free-text party type typed by the organizer (e.g. "Birthday", "Rave"). */
  party_type: string | null;
  media: PartyMedia[];
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  starts_at: string;
  capacity: number | null;
  created_at: string;
  /** Joined organizer username (from profiles) — optional, fetched via join. */
  organizer_username?: string;
}

export interface Rsvp {
  party_id: string;
  user_id: string;
  status: 'going' | 'interested';
  created_at: string;
}

export interface PartyComment {
  id: string;
  party_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_username?: string;
}

export interface Report {
  id: string;
  party_id: string;
  reporter_id: string;
  reason: string;
  created_at: string;
}
