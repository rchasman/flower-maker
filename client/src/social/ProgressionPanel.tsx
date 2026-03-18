import { useSession } from "../session/SessionProvider.tsx";
import { useSkinDefinitions } from "../spacetime/hooks.ts";
import type { User } from "../spacetime/types.ts";

interface ProgressionPanelProps {
  user: User | null;
}

export function ProgressionPanel({ user }: ProgressionPanelProps) {
  const { conn } = useSession();
  const skinDefs = useSkinDefinitions(conn);

  if (!user) return null;

  const xp = Number(user.xp);

  // Sort skins by unlock XP ascending
  const sortedSkins = [...skinDefs]
    .map(s => ({
      name: s.name,
      xp: Number(s.unlockXp),
      cssClass: s.cssClass,
    }))
    .sort((a, b) => a.xp - b.xp);

  // Use skin_definition table data, fallback to hardcoded if table empty
  const thresholds =
    sortedSkins.length > 0
      ? sortedSkins.map(s => ({
          name: s.name,
          xp: s.xp,
          color: skinColor(s.cssClass),
        }))
      : FALLBACK_THRESHOLDS;

  const currentSkin =
    [...thresholds].reverse().find(s => xp >= s.xp) ?? thresholds[0]!;
  const nextSkin = thresholds.find(s => s.xp > xp);
  const progress = nextSkin
    ? ((xp - (currentSkin?.xp ?? 0)) / (nextSkin.xp - (currentSkin?.xp ?? 0))) *
      100
    : 100;

  return (
    <div
      style={{
        padding: "0.75rem",
        background: "#141414",
        borderRadius: "0.375rem",
        border: "1px solid #1a1a1a",
        fontSize: "0.6875rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
        }}
      >
        <span
          style={{ color: currentSkin?.color ?? "#737373", fontWeight: 500 }}
        >
          {currentSkin?.name ?? "Unknown"}
        </span>
        <span style={{ color: "#525252" }}>
          {xp} XP · lvl {Number(user.level)}
        </span>
      </div>

      {nextSkin && (
        <>
          <div
            style={{
              height: "0.25rem",
              background: "#1a1a1a",
              borderRadius: "0.125rem",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: nextSkin.color,
                borderRadius: "0.125rem",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div
            style={{
              color: "#404040",
              fontSize: "0.625rem",
              marginTop: "0.25rem",
            }}
          >
            {nextSkin.xp - xp} XP to {nextSkin.name}
          </div>
        </>
      )}

      <div style={{ color: "#525252", marginTop: "0.375rem" }}>
        {Number(user.totalOrders)} orders placed
      </div>
    </div>
  );
}

// Map CSS class names from SkinDefinition to display colors
function skinColor(cssClass: string): string {
  const map: Record<string, string> = {
    "skin-seedling": "#737373",
    "skin-petal-pusher": "#22c55e",
    "skin-garden-keeper": "#3b82f6",
    "skin-bloom-lord": "#a855f7",
    "skin-eternal-flower": "#f59e0b",
  };
  return map[cssClass] ?? "#737373";
}

// Fallback when skin_definition table hasn't been seeded yet
const FALLBACK_THRESHOLDS = [
  { name: "Seedling", xp: 0, color: "#737373" },
  { name: "Petal Pusher", xp: 500, color: "#22c55e" },
  { name: "Garden Keeper", xp: 2000, color: "#3b82f6" },
  { name: "Bloom Lord", xp: 10000, color: "#a855f7" },
  { name: "Eternal Flower", xp: 50000, color: "#f59e0b" },
];
