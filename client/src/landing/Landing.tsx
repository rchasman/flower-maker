import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useAuth } from "react-oidc-context";
import { useSession } from "../session/SessionProvider.tsx";
import { AssemblyLineCanvas } from "./AssemblyLineCanvas.tsx";

interface LandingProps {
  children: ReactNode;
}

const MAX_NAME_LENGTH = 32;

/**
 * The landing doubles as the name gate. It renders children once the user has a name;
 * until then the animated assembly line runs behind a centred invitation to pick a name.
 */
export function Landing({ children }: LandingProps) {
  const { state, conn, myUser } = useSession();
  const auth = useAuth();
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (myUser?.name) return <>{children}</>;

  const connected = state === "connected" && conn !== null;

  const handleSubmit = () => {
    if (!conn) return;
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
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "var(--surface)",
        overflow: "hidden",
        cursor: "crosshair",
      }}
    >
      <AssemblyLineCanvas />

      <header
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "1.25rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span className="wordmark">flower-maker</span>
        <ConnectionLabel state={state} />
      </header>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "62%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "3rem 1.5rem 0",
        }}
      >
        <span className="label" style={{ marginBottom: "1.25rem" }}>
          A multiplayer flower garden, streaming live
        </span>

        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: "clamp(2.5rem, 5.5vw, 4.75rem)",
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            maxWidth: "18ch",
            marginBottom: "1.25rem",
          }}
        >
          A garden everyone is growing at once.
        </h1>

        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "1.0625rem",
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            maxWidth: "40ch",
            marginBottom: "1.75rem",
          }}
        >
          Pick a stem, grow it, and watch everyone else's grow live beside
          yours.
        </p>

        <form
          onSubmit={e => {
            e.preventDefault();
            handleSubmit();
          }}
          style={{ display: "flex", gap: "0.5rem", width: "min(100%, 26rem)" }}
        >
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={connected ? "Your name" : "Connecting"}
            maxLength={MAX_NAME_LENGTH}
            autoFocus
            disabled={!connected || submitting}
            className="input"
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            disabled={!connected || submitting || !draft.trim()}
            className="btn btn-primary"
          >
            Step in
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
              marginTop: "1.5rem",
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

function ConnectionLabel({ state }: { state: string }) {
  if (state === "connected") {
    return (
      <span className="label" style={{ color: "var(--positive)" }}>
        Connected
      </span>
    );
  }
  if (state === "connecting") {
    return (
      <span className="label">
        Connecting
        <span className="generating" />
      </span>
    );
  }
  return (
    <span className="label" style={{ color: "var(--negative)" }}>
      Offline. Restart the database and refresh.
    </span>
  );
}
