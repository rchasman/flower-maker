import type { AuthProviderProps } from "react-oidc-context";

const AUTHORITY = "https://auth.spacetimedb.com/oidc";
const CLIENT_ID = "client_032kQMNLnSvCAxcPxcN4IJ";

export const oidcConfig: AuthProviderProps = {
  authority: AUTHORITY,
  client_id: CLIENT_ID,
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: window.location.origin,
  scope: "openid profile email",
  response_type: "code",
  automaticSilentRenew: true,
  onSigninCallback: () => {
    // Strip the ?code=... from the URL after successful login
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};

/**
 * Whether a signed-in session is waiting in storage. react-oidc-context reports
 * a returning visitor as signed out until it finishes rehydrating, so this is
 * the only synchronous way to tell a returning visitor from a new one.
 */
export function hasStoredOidcSession(): boolean {
  const key = `oidc.user:${AUTHORITY}:${CLIENT_ID}`;
  try {
    return (
      sessionStorage.getItem(key) !== null || localStorage.getItem(key) !== null
    );
  } catch {
    return false;
  }
}
