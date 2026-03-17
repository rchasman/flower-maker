import type { DbConnection } from "../spacetime/types.ts";

const TEMPLATES = [
  {
    name: "Rose",
    emoji: "🌹",
    scientific: "Rosa damascena",
    colors: ["Red", "Pink", "White"],
  },
  {
    name: "Sunflower",
    emoji: "🌻",
    scientific: "Helianthus annuus",
    colors: ["Yellow", "Orange"],
  },
  {
    name: "Daisy",
    emoji: "🌼",
    scientific: "Bellis perennis",
    colors: ["White", "Pink"],
  },
  {
    name: "Orchid",
    emoji: "🪻",
    scientific: "Phalaenopsis amabilis",
    colors: ["White", "Purple"],
  },
  {
    name: "Tulip",
    emoji: "🌷",
    scientific: "Tulipa gesneriana",
    colors: ["Red", "Yellow", "Purple"],
  },
];

interface TemplatePickerProps {
  conn: DbConnection | null;
}

export function TemplatePicker({ conn }: TemplatePickerProps) {
  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: "0.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
      }}
    >
      {TEMPLATES.map(t => (
        <button
          key={t.name}
          onClick={() => {
            conn?.reducers.createSession({ prompt: t.name });
          }}
          disabled={!conn}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.625rem 0.75rem",
            background: "#141414",
            border: "1px solid #1a1a1a",
            borderRadius: "0.375rem",
            cursor: conn ? "pointer" : "not-allowed",
            textAlign: "left",
            color: "#e5e5e5",
            opacity: conn ? 1 : 0.5,
            transition: "border-color 0.15s",
          }}
        >
          <span style={{ fontSize: "1.25rem" }}>{t.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
              {t.name}
            </div>
            <div
              style={{
                fontSize: "0.625rem",
                color: "#525252",
                fontStyle: "italic",
              }}
            >
              {t.scientific}
            </div>
            <div
              style={{
                fontSize: "0.625rem",
                color: "#404040",
                marginTop: "0.125rem",
              }}
            >
              {t.colors.join(" · ")}
            </div>
          </div>
        </button>
      ))}

      <div
        style={{
          padding: "0.75rem",
          fontSize: "0.6875rem",
          color: "#404040",
          textAlign: "center",
        }}
      >
        5 of 45 templates · more coming soon
      </div>
    </div>
  );
}
