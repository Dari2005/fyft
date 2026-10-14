import { supabase } from './supabase';

export type ReportResult = 'ok' | 'already-reported' | 'error';

/**
 * Files a report against a party. Each user can report a given party only
 * once (unique constraint on (party_id, reporter_id)) — the duplicate case
 * is detected via the Postgres 23505 code and surfaced gracefully.
 */
export async function reportParty(
  partyId: string,
  reporterId: string,
  reason: string
): Promise<ReportResult> {
  try {
    const { error } = await supabase
      .from('reports')
      .insert({ party_id: partyId, reporter_id: reporterId, reason });

    if (error) {
      // 23505 = unique violation → the user already reported this party.
      if (error.code === '23505') return 'already-reported';
      throw error;
    }
    return 'ok';
  } catch {
    return 'error';
  }
}
