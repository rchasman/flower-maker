import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "react-oidc-context";
import { useSession } from "../session/SessionProvider.tsx";
import { AssemblyLineCanvas } from "./AssemblyLineCanvas.tsx";

interface LandingProps {
  children: ReactNode;
}

const MAX_NAME_LENGTH = 32;
const PHRASES = [
  { text: "for everyone", accent: false },
  { text: "for agents", accent: true },
  { text: "by everyone at once", accent: false },
  { text: "to any address", accent: false },
] as const;
const PHRASE_PAUSE_MS = 2500;
const ACCENT_PAUSE_MS = 5000;

/**
 * The landing doubles as the name gate. It renders children once the user has a name;
 * until then the animated assembly line fills the viewport with the name form over it.
 */
export function Landing({ children }: LandingProps) {
  const { state, conn, myUser } = useSession();
  const auth = useAuth();
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const phrase = PHRASES[phraseIndex] ?? PHRASES[0];

  useEffect(() => {
    const delay = phrase.accent ? ACCENT_PAUSE_MS : PHRASE_PAUSE_MS;
    const timeout = setTimeout(
      () => setPhraseIndex(i => (i + 1) % PHRASES.length),
      delay,
    );
    return () => clearTimeout(timeout);
  }, [phraseIndex, phrase.accent]);

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
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: "absolute",
          left: "1.5rem",
          right: "1.5rem",
          bottom: "2rem",
          maxWidth: 640,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: "clamp(3rem, 7vw, 6rem)",
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            marginBottom: "1.5rem",
          }}
        >
          <span style={{ display: "block" }}>Flowers, assembled.</span>
          <span
            style={{
              display: "block",
              height: "1.1em",
              overflow: "hidden",
              fontStyle: "italic",
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={phraseIndex}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "-100%" }}
                transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                style={{
                  display: "block",
                  whiteSpace: "nowrap",
                  color: phrase.accent
                    ? "var(--accent)"
                    : "var(--text-tertiary)",
                }}
              >
                {phrase.text}
              </motion.span>
            </AnimatePresence>
          </span>
        </h1>

        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "1rem",
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            maxWidth: 480,
            marginBottom: "1.5rem",
          }}
        >
          Design a flower, watch everyone else design theirs live, and order the
          result as JSON.
        </p>

        <form
          onSubmit={e => {
            e.preventDefault();
            handleSubmit();
          }}
          style={{ display: "flex", gap: "0.5rem", maxWidth: 480 }}
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
