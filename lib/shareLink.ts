/**
 * Share links for events.
 *
 * WhatsApp, Instagram and Messenger only make https links clickable, not
 * `fyft://` links. So the shared link points to a small static page
 * (`docs/e/index.html`, served by GitHub Pages from this public repo). That
 * page opens `fyft://party/<id>` in the app if it is installed, and otherwise
 * shows a fallback. The event details travel in the message text itself, so
 * the message is useful even when the link cannot open the app.
 *
 * There is no custom domain. If one is added later, change SHARE_PAGE_URL and
 * update the page; old links keep working as long as the old page stays up.
 */
export const SHARE_PAGE_URL = 'https://dari2005.github.io/fyft/e/';

/** The in-app deep link (the "fyft" scheme from app.json; expo-router routes it). */
export function eventDeepLink(partyId: string): string {
  return `fyft://party/${encodeURIComponent(partyId)}`;
}

/** The https link that goes into shared messages. */
export function eventShareUrl(partyId: string): string {
  return `${SHARE_PAGE_URL}?id=${encodeURIComponent(partyId)}`;
}

/** Message text: name, date, venue, link (one item per line, blanks skipped). */
export function eventShareMessage(args: {
  id: string;
  title: string;
  when: string;
  hostName?: string | null;
  address?: string | null;
}): string {
  const venue = [args.hostName?.trim(), args.address?.trim()].filter(Boolean).join(', ');
  return [args.title, args.when, venue, eventShareUrl(args.id)].filter(Boolean).join('\n');
}
