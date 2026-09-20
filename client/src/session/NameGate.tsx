import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useAuth } from "react-oidc-context";
import { useSession } from "./SessionProvider.tsx";

interface NameGateProps {
  children: ReactNode;
}

const MAX_NAME_LENGTH = 32;

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

  if (state !== "connected" || !conn) {
    return (
      <div style={centerStyle}>
        <div style={{ textAlign: "center" }}>
          <h1 style={wordmarkStyle}>flower-maker</h1>
          <div className="label" style={{ marginTop: "1.5rem" }}>
            {state === "connecting" ? (
              <span>
                Connecting
                <span className="generating" />
              </span>
            ) : (
              <span style={{ color: "var(--negative)" }}>
                The database is offline. Restart it and refresh.
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (myUser?.name) return <>{children}</>;

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_NAME_LENGTH) {
      setError(`Names are ${MAX_NAME_LENGTH} characters at most.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    void conn.reducers.setName({ name: trimmed });
    setTimeout(() => setSubmitting(false), 500);
  };

  return (
    <div style={centerStyle}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ maxWidth: 480, width: "100%", padding: "2rem" }}
      >
        <h1 style={wordmarkStyle}>flower-maker</h1>

        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "1rem",
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            margin: "1.5rem 0 2rem",
          }}
        >
          Pick a name to claim a zone. Everyone connected sees your work live.
        </p>

        <form
          onSubmit={e => {
            e.preventDefault();
            handleSubmit();
          }}
          style={{ display: "flex", gap: "0.5rem" }}
        >
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="your name"
            maxLength={MAX_NAME_LENGTH}
            autoFocus
            disabled={submitting}
            className="input"
            style={{ flex: 1, opacity: submitting ? 0.5 : 1 }}
          />
          <button
            type="submit"
            disabled={submitting || !draft.trim()}
            className="btn btn-primary"
          >
            Enter
          </button>
        </form>

        {error && (
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "var(--font-size-sm)",
              color: "var(--negative)",
            }}
          >
            {error}
          </p>
        )}

        {!auth.isAuthenticated && (
          <button
            onClick={() => auth.signinRedirect()}
            className="label"
            style={{
              marginTop: "2rem",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: "0.25em",
            }}
          >
            Sign in with SpacetimeAuth
          </button>
        )}
      </motion.div>
    </div>
  );
}

const centerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--surface)",
};

const wordmarkStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontWeight: 400,
  fontSize: "2.5rem",
  lineHeight: 1,
  letterSpacing: "-0.02em",
  color: "var(--text-primary)",
};
