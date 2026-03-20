import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "react-oidc-context";
import { useSession } from "./SessionProvider.tsx";

interface NameGateProps {
  children: ReactNode;
}

const ASCII_LOGO = `
 ┌─────────────────────────────────────────┐
 │  ╔═╗╦  ╔═╗╦ ╦╔═╗╦═╗  ╔╦╗╔═╗╦╔═╔═╗╦═╗ │
 │  ╠╣ ║  ║ ║║║║║╣ ╠╦╝  ║║║╠═╣╠╩╗║╣ ╠╦╝ │
 │  ╚  ╩═╝╚═╝╚╩╝╚═╝╩╚═  ╩ ╩╩ ╩╩ ╩╚═╝╩╚═ │
 └─────────────────────────────────────────┘`;

const BOOT_LINES = [
  "[sys] initializing flower-maker kernel...",
  "[net] establishing spacetimedb link...",
  "[gpu] pixi.js renderer online",
  "[ai ] gemini gateway connected",
  "[ok ] all systems nominal",
];

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
  const [bootStep, setBootStep] = useState(0);
  const [booted, setBooted] = useState(false);

  // Boot sequence animation
  useEffect(() => {
    if (state !== "connected") return;
    if (booted) return;

    const timer = setInterval(() => {
      setBootStep(prev => {
        if (prev >= BOOT_LINES.length) {
          clearInterval(timer);
          setBooted(true);
          return prev;
        }
        return prev + 1;
      });
    }, 180);

    return () => clearInterval(timer);
  }, [state, booted]);

  // Show connection status while waiting
  if (state !== "connected" || !conn) {
    return (
      <div style={centerStyle}>
        <div style={{ textAlign: "center" }}>
          <pre className="tui-ascii-art" style={{ marginBottom: "1.5rem" }}>
            {ASCII_LOGO}
          </pre>
          <div style={{ color: "var(--tui-fg-3)", fontSize: "var(--tui-font-size-sm)" }}>
            {state === "connecting" ? (
              <span>
                <span style={{ color: "var(--tui-amber)" }}>[sync]</span>{" "}
                establishing connection<span className="tui-generating" />
              </span>
            ) : (
              <span>
                <span style={{ color: "var(--tui-red)" }}>[err]</span>{" "}
                spacetimedb offline — restart and refresh
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // User already has a name — pass through
  if (myUser?.name) return <>{children}</>;

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (trimmed.length > 32) {
      setError("ERR: callsign exceeds 32 char limit");
      return;
    }
    setSubmitting(true);
    setError(null);
    conn.reducers.setName({ name: trimmed });
    setTimeout(() => setSubmitting(false), 500);
  };

  return (
    <div style={centerStyle}>
      <div style={{ maxWidth: 420, width: "100%", padding: "2rem" }}>
        {/* ASCII Logo — phosphor glow + subtle glitch */}
        <motion.pre
          className="tui-ascii-art tui-glitch-skew"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: "1.5rem" }}
        >
          {ASCII_LOGO}
        </motion.pre>

        {/* Boot sequence log */}
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "0.75rem 1ch",
            border: "1px solid var(--tui-border)",
            background: "var(--tui-bg-0)",
            minHeight: "7.5rem",
          }}
        >
          <AnimatePresence>
            {BOOT_LINES.slice(0, bootStep).map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className={line.includes("[ok") ? "tui-glow-green" : ""}
                style={{
                  fontSize: "var(--tui-font-size-xs)",
                  lineHeight: 1.6,
                  color: line.includes("[ok") ? "var(--tui-green)" : "var(--tui-fg-3)",
                }}
              >
                {line}
              </motion.div>
            ))}
          </AnimatePresence>
          {!booted && (
            <span className="tui-cursor" style={{ marginTop: "0.25rem" }} />
          )}
        </div>

        {/* Name prompt — only shows after boot */}
        <AnimatePresence>
          {booted && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div
                style={{
                  fontSize: "var(--tui-font-size-sm)",
                  color: "var(--tui-fg-2)",
                  marginBottom: "0.75rem",
                }}
              >
                enter your callsign to claim a zone on the grid.
                <br />
                all connected operators will see your work live.
              </div>

              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleSubmit();
                }}
                style={{ display: "flex", gap: "0.5rem" }}
              >
                <div className="tui-input-wrap" style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder="callsign"
                    maxLength={32}
                    autoFocus
                    disabled={submitting}
                    className="tui-input"
                    style={{ opacity: submitting ? 0.5 : 1 }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || !draft.trim()}
                  className={`tui-btn ${draft.trim() ? "tui-btn-primary" : ""}`}
                >
                  ENTER
                </button>
              </form>

              {error && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    fontSize: "var(--tui-font-size-sm)",
                    color: "var(--tui-red)",
                  }}
                >
                  {error}
                </div>
              )}

              {!auth.isAuthenticated && (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1ch",
                      margin: "1rem 0",
                    }}
                  >
                    <div style={{ flex: 1, height: 1, background: "var(--tui-border)" }} />
                    <span style={{ fontSize: "var(--tui-font-size-xs)", color: "var(--tui-fg-4)" }}>
                      OR
                    </span>
                    <div style={{ flex: 1, height: 1, background: "var(--tui-border)" }} />
                  </div>
                  <button
                    onClick={() => auth.signinRedirect()}
                    className="tui-btn"
                    style={{ width: "100%" }}
                  >
                    AUTH VIA SPACETIME
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
  background: "var(--tui-bg-1)",
};
