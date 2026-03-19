import { useState, type ReactNode } from "react";
import { useAuth } from "react-oidc-context";
import { useSession } from "./SessionProvider.tsx";

interface NameGateProps {
  children: ReactNode;
}

/**
 * Gates the app behind a name prompt.
 * Users can enter a name anonymously or sign in via SpacetimeAuth.
 */
export function NameGate({ children }: NameGateProps) {
  const { state, conn, myUser } = useSession();
  const auth = useAuth();
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show connection status while waiting
  if (state !== "connected" || !conn) {
    return (
      <div style={centerStyle}>
        <span style={{ color: "#525252", fontSize: "0.8125rem" }}>
          {state === "connecting"
            ? "Connecting to SpacetimeDB..."
            : "Not connected — start SpacetimeDB and refresh"}
        </span>
      </div>
    );
  }

  // User already has a name — pass through
  if (myUser?.name) return <>{children}</>;

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (trimmed.length > 32) {
      setError("Name too long (max 32 chars)");
      return;
    }
    setSubmitting(true);
    setError(null);
    conn.reducers.setName({ name: trimmed });
    setTimeout(() => setSubmitting(false), 500);
  };

  return (
    <div style={centerStyle}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
          maxWidth: 320,
          padding: "2rem",
        }}
      >
        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            color: "#e5e5e5",
          }}
        >
          flower-maker
        </h1>

        <p style={{ fontSize: "0.8125rem", color: "#737373", textAlign: "center" }}>
          Choose a name for your spot on the grid.
          <br />
          Everyone will see your latest design live.
        </p>

        <form
          onSubmit={e => {
            e.preventDefault();
            handleSubmit();
          }}
          style={{ display: "flex", gap: "0.5rem", width: "100%" }}
        >
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Your name"
            maxLength={32}
            autoFocus
            disabled={submitting}
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "0.25rem",
              color: "#e5e5e5",
              fontSize: "0.875rem",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={submitting || !draft.trim()}
            style={{
              padding: "0.5rem 1rem",
              background: draft.trim() ? "#3b3b6d" : "#1a1a2e",
              border: "1px solid #3b3b6d",
              borderRadius: "0.25rem",
              color: "#e5e5e5",
              fontSize: "0.875rem",
              cursor: draft.trim() ? "pointer" : "default",
              opacity: submitting ? 0.5 : 1,
            }}
          >
            Enter
          </button>
        </form>

        {error && (
          <p style={{ fontSize: "0.75rem", color: "#f87171" }}>{error}</p>
        )}

        {!auth.isAuthenticated && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%" }}>
              <div style={{ flex: 1, height: 1, background: "#333" }} />
              <span style={{ fontSize: "0.6875rem", color: "#525252" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#333" }} />
            </div>
            <button
              onClick={() => auth.signinRedirect()}
              style={{
                width: "100%",
                padding: "0.5rem 1rem",
                background: "transparent",
                border: "1px solid #333",
                borderRadius: "0.25rem",
                color: "#737373",
                fontSize: "0.8125rem",
                cursor: "pointer",
              }}
            >
              Sign in with SpacetimeAuth
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const centerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0a0a0a",
};
