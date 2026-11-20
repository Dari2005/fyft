import * as WebBrowser from 'expo-web-browser';

/**
 * Public pages served by GitHub Pages from /docs on main (same host as the
 * share links, see lib/shareLink.ts). The Play Store listing links to both.
 */
const PAGES = 'https://dari2005.github.io/fyft';

export const PRIVACY_URL = `${PAGES}/privacy/`;
/** Web page explaining how to delete an account (Google Play requirement). */
export const DELETE_ACCOUNT_URL = `${PAGES}/delete-account/`;

export function openPrivacyPolicy(): void {
  WebBrowser.openBrowserAsync(PRIVACY_URL).catch(() => {});
}
