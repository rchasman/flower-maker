import { scoreColor } from "../lib/utils.ts";
import { useSession } from "../session/SessionProvider.tsx";
import { useFitnessScores, useEnvironments } from "../spacetime/hooks.ts";

interface FitnessBreakdownProps {
  sessionId: number | null;
}

export function FitnessBreakdown({ sessionId }: FitnessBreakdownProps) {
  const { conn } = useSession();
  const allScores = useFitnessScores(conn);
  const environments = useEnvironments(conn);

  if (!sessionId) {
    return (
      <div
        style={{ padding: "0.75rem", color: "#404040", fontSize: "0.6875rem" }}
      >
        Select a flower to see fitness scores.
      </div>
    );
  }

  const scores = allScores.filter(s => s.session_id === sessionId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      {scores.length === 0 && (
        <div style={{ color: "#404040", fontSize: "0.6875rem" }}>
          No fitness data yet. Merge flowers to evaluate.
        </div>
      )}
      {scores.map(score => {
        const env = environments.find(e => e.id === score.environment_id);
        return (
          <div
            key={score.id}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span
              style={{
                fontSize: "0.625rem",
                color: "#737373",
                width: "4.5rem",
              }}
            >
              {env?.name ?? `Env #${score.environment_id}`}
            </span>
            <div
              style={{
                flex: 1,
                height: "0.375rem",
                background: "#1a1a1a",
                borderRadius: "0.1875rem",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${score.score}%`,
                  height: "100%",
                  borderRadius: "0.1875rem",
                  background: scoreColor(score.score),
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <span
              style={{
                fontSize: "0.625rem",
                fontFamily: "'Geist Mono', monospace",
                color: "#525252",
                width: "2rem",
                textAlign: "right",
              }}
            >
              {score.score.toFixed(0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
