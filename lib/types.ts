/** Shared TypeScript types matching the Supabase schema in supabase/schema.sql */

export type VenueType = 'house' | 'club';

export interface Party {
  id: string;
  organizer_id: string;
  title: string;
  description: string | null;
  venue_type: VenueType;
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
