import { motion } from "motion/react";
import { run } from "../lib/utils.ts";
import type { LoadStage } from "./loadStage.ts";

const STAGES: { key: LoadStage; status: string }[] = [
  { key: "session", status: "Restoring your session" },
  { key: "connecting", status: "Connecting to the garden" },
  { key: "claiming", status: "Bringing over your flowers" },
];

interface SignedInLoaderProps {
  stage: LoadStage;
  greeting: string | null;
}

/**
 * Shown to a signed-in visitor while the session, the connection and the
 * identity claim settle. It replaces the name gate, which they already passed.
 */
export function SignedInLoader({ stage, greeting }: SignedInLoaderProps) {
  const failed = stage === "error";
  const current = STAGES.find(s => s.key === stage);
  const reached = current ? STAGES.indexOf(current) : STAGES.length - 1;

  return (
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
        {greeting ? `Welcome back, ${greeting}` : "Welcome back"}
      </span>

      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 400,
          fontSize: "clamp(2rem, 4vw, 3.25rem)",
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
          maxWidth: "18ch",
          marginBottom: "1.75rem",
        }}
      >
        Opening your garden.
      </h1>

      <div
        style={{
          display: "flex",
          gap: "0.375rem",
          width: "min(100%, 18rem)",
          marginBottom: "1rem",
        }}
      >
        {STAGES.map((s, i) => (
          <span
            key={s.key}
            style={{
              flex: 1,
              height: 2,
              background: run(() => {
                if (failed) return "var(--negative)";
                if (i < reached) return "var(--accent)";
                if (i === reached) return "var(--text-tertiary)";
                return "var(--border)";
              }),
            }}
          />
        ))}
      </div>

      {failed ? (
        <span className="label" style={{ color: "var(--negative)" }}>
          Offline. Restart the database and refresh.
        </span>
      ) : (
        <span className="label">
          {current?.status ?? "Loading"}
          <span className="generating" />
        </span>
      )}
    </motion.div>
  );
}
