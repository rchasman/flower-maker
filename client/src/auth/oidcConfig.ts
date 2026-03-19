import type { AuthProviderProps } from "react-oidc-context";

export const oidcConfig: AuthProviderProps = {
  authority: "https://auth.spacetimedb.com/oidc",
  client_id: "client_032kQMNLnSvCAxcPxcN4IJ",
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
