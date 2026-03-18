import { useState, type ReactNode } from "react";
import { useSession } from "./SessionProvider.tsx";

interface NameGateProps {
  children: ReactNode;
}

/**
 * Gates the app behind a name prompt for anonymous users.
 * SpacetimeDB auto-generates an identity on first connect, but the User row
 * starts with name: null. This component prompts for a display name before
 * letting the user through to the grid.
 */
export function NameGate({ children }: NameGateProps) {
  const { state, conn, myUser } = useSession();
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show connection status while waiting
  if (state !== "connected" || !conn) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#525252",
          fontSize: "0.8125rem",
        }}
      >
        {state === "connecting"
          ? "Connecting to SpacetimeDB..."
          : "Not connected — start SpacetimeDB and refresh"}
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
    // The User table will update via subscription — SessionProvider re-derives myUser
    // Give it a moment to propagate
    setTimeout(() => setSubmitting(false), 500);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
      }}
    >
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
      </div>
    </div>
  );
}
