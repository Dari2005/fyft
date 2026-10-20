/** Shared TypeScript types matching the Supabase schema in supabase/schema.sql */

export type VenueType = 'house' | 'club';

/** Music genre of a party. Stored in parties.genre (nullable). */
export type Genre =
  | 'techno'
  | 'house'
  | 'hiphop'
  | 'pop'
  | 'narodno'
  | 'rock'
  | 'disco'
  | 'other';

/** All genres with Macedonian labels, in display order. */
export const GENRES: { value: Genre; label: string }[] = [
  { value: 'techno', label: '🎧 Техно' },
  { value: 'house', label: '🎵 Хаус' },
  { value: 'hiphop', label: '🎤 Хип-хоп' },
  { value: 'pop', label: '✨ Поп' },
  { value: 'narodno', label: '🪗 Народно' },
  { value: 'rock', label: '🎸 Рок' },
  { value: 'disco', label: '🪩 Диско' },
  { value: 'other', label: '🎉 Друго' },
];

export function genreLabel(genre: Genre | null | undefined): string | null {
  if (!genre) return null;
  return GENRES.find((g) => g.value === genre)?.label ?? null;
}

export interface Party {
  id: string;
  organizer_id: string;
  title: string;
  description: string | null;
  venue_type: VenueType;
  genre: Genre | null;
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
