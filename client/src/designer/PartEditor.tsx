import { useState } from "react";
import { useSession } from "../session/SessionProvider.tsx";
import { run } from "../lib/utils.ts";

interface ConstituentInfo {
  index: number;
  specJson: string;
  forkedFrom: string;
}

interface PartEditorProps {
  sessionId: number;
  specJson: string;
  constituents?: ConstituentInfo[];
}

interface EditableField {
  path: string;
  label: string;
  type: "number" | "color" | "select";
  options?: string[];
}

const EDITABLE_FIELDS: EditableField[] = [
  { path: "personality.growth_speed", label: "Growth Speed", type: "number" },
  { path: "personality.hardiness", label: "Hardiness", type: "number" },
  { path: "personality.sociability", label: "Sociability", type: "number" },
  { path: "personality.water_need", label: "Water Need", type: "number" },
  {
    path: "personality.pollinator_attraction",
    label: "Pollinator Attraction",
    type: "number",
  },
  {
    path: "personality.light_preference",
    label: "Light",
    type: "select",
    options: ["FullSun", "PartialShade", "FullShade", "Nocturnal"],
  },
  {
    path: "personality.wind_response",
    label: "Wind Response",
    type: "select",
    options: ["Rigid", "Gentle", "Dramatic", "Dancing"],
  },
  { path: "structure.stem.height", label: "Stem Height", type: "number" },
  { path: "structure.stem.thickness", label: "Stem Thickness", type: "number" },
  { path: "structure.stem.curvature", label: "Stem Curve", type: "number" },
  { path: "roots.depth", label: "Root Depth", type: "number" },
  {
    path: "roots.mycorrhizal",
    label: "Mycorrhizal",
    type: "select",
    options: ["true", "false"],
  },
];

export function PartEditor({ sessionId, specJson, constituents = [] }: PartEditorProps) {
  const { conn } = useSession();
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const spec = run(() => {
    try {
      return JSON.parse(specJson) as Record<string, unknown>;
    } catch {
      return {};
    }
  });

  const getNestedValue = (
    obj: Record<string, unknown>,
    path: string,
  ): unknown =>
    path.split(".").reduce<unknown>((o, k) => {
      if (o && typeof o === "object" && k in (o as Record<string, unknown>)) {
        return (o as Record<string, unknown>)[k];
      }
      return null;
    }, obj);

  const handleChange = (path: string, value: string) => {
    setOverrides(prev => ({ ...prev, [path]: value }));
  };

  const handleFork = () => {
    if (!conn || Object.keys(overrides).length === 0) return;

    Object.entries(overrides).forEach(([path, value]) => {
      conn.reducers.forkPart({ sessionId: BigInt(sessionId), partPath: path, overrideJson: value, forkedFrom: path });
    });

    setOverrides({});
    console.log(
      "[fork] Forked",
      Object.keys(overrides).length,
      "parts for session",
      sessionId,
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "#a3a3a3" }}>
        Edit Parts
      </div>

      {EDITABLE_FIELDS.map(field => {
        const currentValue = getNestedValue(spec, field.path);
        const overrideValue = overrides[field.path];
        const displayValue =
          overrideValue ??
          (currentValue != null ? JSON.stringify(currentValue) : "");

        return (
          <div
            key={field.path}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.6875rem",
            }}
          >
            <span style={{ color: "#737373", width: "7rem", flexShrink: 0 }}>
              {field.label}
            </span>
            {field.type === "select" && field.options ? (
              <select
                value={displayValue}
                onChange={e => handleChange(field.path, e.target.value)}
                style={{
                  flex: 1,
                  padding: "0.25rem 0.375rem",
                  background: "#141414",
                  border: "1px solid #262626",
                  borderRadius: "0.1875rem",
                  color: "#e5e5e5",
                  fontSize: "0.6875rem",
                }}
              >
                {field.options.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                step="0.1"
                min="0"
                max="3"
                value={displayValue}
                onChange={e => handleChange(field.path, e.target.value)}
                style={{
                  flex: 1,
                  padding: "0.25rem 0.375rem",
                  background: "#141414",
                  border: "1px solid #262626",
                  borderRadius: "0.1875rem",
                  color: "#e5e5e5",
                  fontSize: "0.6875rem",
                  width: "4rem",
                }}
              />
            )}
            {overrideValue !== undefined && (
              <span style={{ color: "#eab308", fontSize: "0.5rem" }}>
                modified
              </span>
            )}
          </div>
        );
      })}

      {Object.keys(overrides).length > 0 && (
        <button
          onClick={handleFork}
          style={{
            padding: "0.5rem",
            background: "#1e3a5f",
            color: "#93c5fd",
            border: "none",
            borderRadius: "0.25rem",
            cursor: "pointer",
            fontSize: "0.75rem",
            fontWeight: 500,
            marginTop: "0.25rem",
          }}
        >
          Fork {Object.keys(overrides).length} part
          {Object.keys(overrides).length > 1 ? "s" : ""}
        </button>
      )}

      {Object.keys(overrides).length === 0 && (
        <p
          style={{
            color: "#404040",
            fontSize: "0.625rem",
            marginTop: "0.25rem",
          }}
        >
          Adjust values above to fork parts. Forks create personal variants that
          others can discover.
        </p>
      )}

      {constituents.length > 1 && (
        <div style={{ marginTop: "0.75rem", borderTop: "1px solid #262626", paddingTop: "0.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "#a3a3a3", marginBottom: "0.375rem" }}>
            Flowers ({constituents.length})
          </div>
          {constituents.map((c) => {
            const cSpec = run(() => {
              try { return JSON.parse(c.specJson) as Record<string, unknown>; }
              catch { return {} as Record<string, unknown>; }
            });
            const name = (cSpec.common_name as string) ?? (cSpec.species as string) ?? `Flower ${c.index}`;
            return (
              <div
                key={c.index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.25rem 0",
                  fontSize: "0.6875rem",
                }}
              >
                <span style={{ color: "#a3a3a3" }}>
                  {c.index === 0 ? `${name} (hero)` : name}
                </span>
                <button
                  onClick={() => {
                    conn?.reducers.removeConstituent({
                      sessionId: BigInt(sessionId),
                      constituentIndex: c.index,
                    });
                  }}
                  style={{
                    background: "none",
                    border: "1px solid #333",
                    borderRadius: "0.1875rem",
                    color: "#737373",
                    cursor: "pointer",
                    fontSize: "0.625rem",
                    padding: "0.125rem 0.375rem",
                  }}
                >
                  remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
