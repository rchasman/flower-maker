import { useState } from "react";
import { useSession } from "../session/SessionProvider.tsx";
import { run, getNestedValue } from "../lib/utils.ts";

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

// ── Full taxonomy schema ──────────────────────────────────────────────────

type FieldDef = {
  path: string;
  label: string;
  type: "number" | "color" | "select";
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
};

type TaxonomySection = {
  key: string;
  label: string;
  accent: string;
  fields: FieldDef[];
};

const PETAL_SHAPES = [
  "Ovate", "Lanceolate", "Spatulate", "Oblong", "Orbicular",
  "Cordate", "Deltoid", "Falcate", "Ligulate", "Fimbriate",
  "Laciniate", "Runcinate", "Cuneate", "Acuminate", "Panduriform",
  "Unguiculate", "Flabellate", "Obovate", "Rhomboid", "Filiform",
  "Reniform", "Sagittate", "Tubular",
];

const EDGE_STYLES = [
  "Smooth", "Ruffled", "Fringed", "Serrated", "Rolled",
  "Undulate", "Crisped", "Lobed", "Plicate", "Revolute",
  "Dentate", "Erose",
];

const ARRANGEMENT_TYPES = ["Radial", "Spiral", "Whorled"];

const AURA_KINDS = [
  "Ethereal", "Prismatic", "Rainbow", "Crystal", "Flame",
  "Solar", "Frost", "Aurora", "Nebula", "Shadow",
  "Void", "Electric", "Storm",
];

const PARTICLE_KINDS = [
  "Pollen", "Sparkle", "Firefly", "Mote", "Ember",
  "Snowflake", "Petal", "Spore",
];

const SYMMETRY_TYPES = ["Radial", "Spiral"];

const DEWDROP_PLACEMENTS = ["Random", "Tips", "Edges", "Center"];

const TAXONOMY: TaxonomySection[] = [
  {
    key: "petals",
    label: "PETALS",
    accent: "var(--tui-purple)",
    fields: [
      { path: "petals.arrangement", label: "arrangement", type: "select", options: ARRANGEMENT_TYPES },
      { path: "petals.layers.0.shape", label: "shape", type: "select", options: PETAL_SHAPES },
      { path: "petals.layers.0.count", label: "count", type: "number", min: 1, max: 60, step: 1 },
      { path: "petals.layers.0.length", label: "length", type: "number", min: 0.1, max: 3, step: 0.05 },
      { path: "petals.layers.0.width", label: "width", type: "number", min: 0.1, max: 2, step: 0.05 },
      { path: "petals.layers.0.curvature", label: "curvature", type: "number", min: -1, max: 1, step: 0.05 },
      { path: "petals.layers.0.curl", label: "curl", type: "number", min: -1, max: 1, step: 0.05 },
      { path: "petals.layers.0.droop", label: "droop", type: "number", min: 0, max: 1, step: 0.05 },
      { path: "petals.layers.0.opacity", label: "opacity", type: "number", min: 0, max: 1, step: 0.05 },
      { path: "petals.layers.0.angularOffset", label: "angular offset", type: "number", min: 0, max: 360, step: 5 },
      { path: "petals.layers.0.edge_style", label: "edge style", type: "select", options: EDGE_STYLES },
    ],
  },
  {
    key: "structure",
    label: "STRUCTURE",
    accent: "var(--tui-green)",
    fields: [
      { path: "structure.stem.height", label: "stem height", type: "number", min: 0, max: 3, step: 0.05 },
      { path: "structure.stem.thickness", label: "stem width", type: "number", min: 0, max: 1, step: 0.02 },
      { path: "structure.stem.curvature", label: "stem curve", type: "number", min: -1, max: 1, step: 0.05 },
      { path: "structure.stem.thorns.density", label: "thorn density", type: "number", min: 0, max: 1, step: 0.1 },
      { path: "structure.stem.thorns.size", label: "thorn size", type: "number", min: 0, max: 1, step: 0.05 },
      { path: "structure.sepals.length", label: "sepal length", type: "number", min: 0, max: 2, step: 0.05 },
      { path: "structure.receptacle.size", label: "receptacle", type: "number", min: 0, max: 2, step: 0.05 },
    ],
  },
  {
    key: "reproductive",
    label: "REPRODUCTIVE",
    accent: "var(--tui-amber)",
    fields: [
      { path: "reproductive.stamens.height", label: "stamen height", type: "number", min: 0, max: 2, step: 0.05 },
      { path: "reproductive.pistil.height", label: "pistil height", type: "number", min: 0, max: 2, step: 0.05 },
    ],
  },
  {
    key: "effects",
    label: "EFFECTS",
    accent: "var(--tui-cyan)",
    fields: [
      { path: "effects.aura.kind", label: "aura", type: "select", options: AURA_KINDS },
      { path: "effects.aura.opacity", label: "aura opacity", type: "number", min: 0, max: 1, step: 0.05 },
      { path: "effects.aura.radius", label: "aura radius", type: "number", min: 0, max: 3, step: 0.1 },
      { path: "effects.particles.kind", label: "particles", type: "select", options: PARTICLE_KINDS },
      { path: "effects.particles.density", label: "particle density", type: "number", min: 0, max: 1, step: 0.05 },
      { path: "effects.particles.drift_speed", label: "drift speed", type: "number", min: 0, max: 2, step: 0.1 },
      { path: "effects.particles.gravity", label: "gravity", type: "number", min: -1, max: 1, step: 0.05 },
      { path: "effects.dewdrops.count", label: "dewdrops", type: "number", min: 0, max: 20, step: 1 },
      { path: "effects.dewdrops.size", label: "dew size", type: "number", min: 0, max: 1, step: 0.05 },
      { path: "effects.dewdrops.placement", label: "dew placement", type: "select", options: DEWDROP_PLACEMENTS },
    ],
  },
  {
    key: "symmetry",
    label: "SYMMETRY",
    accent: "var(--tui-blue)",
    fields: [
      { path: "symmetry", label: "type", type: "select", options: SYMMETRY_TYPES },
    ],
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export function PartEditor({ sessionId, specJson, constituents = [] }: PartEditorProps) {
  const { conn } = useSession();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const spec = run(() => {
    try {
      return JSON.parse(specJson) as Record<string, unknown>;
    } catch {
      return {};
    }
  });

  const toggleSection = (key: string) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const handleChange = (path: string, value: string) => {
    setOverrides(prev => ({ ...prev, [path]: value }));
  };

  const handleFork = () => {
    if (!conn || Object.keys(overrides).length === 0) return;

    Object.entries(overrides).forEach(([path, value]) => {
      conn.reducers.forkPart({ sessionId: BigInt(sessionId), partPath: path, overrideJson: value, forkedFrom: path });
    });

    setOverrides({});
  };

  const modifiedCount = Object.keys(overrides).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      {/* ── Constituents (always visible) ── */}
      {constituents.length > 0 && (
        <div
          className="tui-panel accent-purple"
          data-label={`FLOWERS (${constituents.length})`}
          style={{ padding: "0.75rem 1ch 0.5rem", marginBottom: "0.5rem" }}
        >
          {constituents.map((c) => {
            const cSpec = run(() => {
              try { return JSON.parse(c.specJson) as Record<string, unknown>; }
              catch { return {} as Record<string, unknown>; }
            });
            const name = (cSpec.name as string) ?? (cSpec.common_name as string) ?? (cSpec.species as string) ?? `Flower ${c.index}`;
            const shape = getNestedValue(cSpec, "petals.layers.0.shape") as string | null;
            return (
              <div
                key={c.index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.25rem 0",
                  fontSize: "var(--tui-font-size-sm)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem", minWidth: 0, flex: 1 }}>
                  <span style={{ color: "var(--tui-fg-1)" }}>
                    {c.index === 0 ? `${name}` : name}
                    {c.index === 0 && (
                      <span className="tui-badge tui-badge-green" style={{ marginLeft: "0.5ch", verticalAlign: "middle" }}>
                        hero
                      </span>
                    )}
                  </span>
                  {shape && (
                    <span style={{ color: "var(--tui-fg-4)", fontSize: "var(--tui-font-size-xs)" }}>
                      {shape}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
                  <button
                    onClick={() => {
                      conn?.reducers.splitConstituent({
                        sessionId: BigInt(sessionId),
                        constituentIndex: c.index,
                      });
                    }}
                    className="tui-btn"
                    style={{
                      padding: "0.125rem 0.5ch",
                      fontSize: "var(--tui-font-size-xs)",
                      color: "var(--tui-cyan)",
                      borderColor: "rgba(103, 232, 249, 0.2)",
                    }}
                  >
                    SPLIT
                  </button>
                  <button
                    onClick={() => {
                      conn?.reducers.removeConstituent({
                        sessionId: BigInt(sessionId),
                        constituentIndex: c.index,
                      });
                    }}
                    className="tui-btn"
                    style={{
                      padding: "0.125rem 0.5ch",
                      fontSize: "var(--tui-font-size-xs)",
                    }}
                  >
                    RM
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Spec identity ── */}
      <div style={{ marginBottom: "0.5rem" }}>
        {(typeof spec.name === "string" || typeof spec.common_name === "string") && (
          <div style={{ color: "var(--tui-fg-0)", fontSize: "var(--tui-font-size-sm)", fontWeight: 600 }}>
            {(spec.name as string) ?? (spec.common_name as string)}
          </div>
        )}
        {typeof spec.species === "string" && (
          <div style={{ color: "var(--tui-fg-3)", fontSize: "var(--tui-font-size-xs)", fontStyle: "italic" }}>
            {spec.species}
          </div>
        )}
      </div>

      {/* ── Taxonomy sections ── */}
      {TAXONOMY.map(section => {
        const isCollapsed = collapsed[section.key] ?? false;
        const sectionOverrides = Object.keys(overrides).filter(k => k.startsWith(section.fields[0]?.path.split(".")[0] ?? ""));

        return (
          <div key={section.key} style={{ marginBottom: "0.25rem" }}>
            {/* Section header */}
            <button
              onClick={() => toggleSection(section.key)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "0.5ch",
                padding: "0.25rem 0",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--tui-font)",
                fontSize: "var(--tui-font-size-xs)",
                color: section.accent,
                letterSpacing: "0.06em",
                textAlign: "left",
              }}
            >
              <span style={{ color: "var(--tui-fg-4)", width: "1.5ch", textAlign: "center" }}>
                {isCollapsed ? "▸" : "▾"}
              </span>
              <span style={{ textShadow: `0 0 6px ${section.accent}33` }}>
                {section.label}
              </span>
              {sectionOverrides.length > 0 && (
                <span style={{
                  marginLeft: "auto",
                  color: "var(--tui-amber)",
                  fontSize: "var(--tui-font-size-2xs)",
                }}>
                  {sectionOverrides.length} modified
                </span>
              )}
            </button>

            {/* Fields */}
            {!isCollapsed && (
              <div style={{ paddingLeft: "1.5ch", display: "flex", flexDirection: "column", gap: "0.1875rem" }}>
                {section.fields.map(field => {
                  const currentValue = getNestedValue(spec, field.path);
                  const overrideValue = overrides[field.path];
                  const displayValue =
                    overrideValue ??
                    (currentValue != null ? String(currentValue) : "");
                  const isModified = overrideValue !== undefined;

                  return (
                    <div
                      key={field.path}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5ch",
                        fontSize: "var(--tui-font-size-xs)",
                      }}
                    >
                      <span style={{
                        color: isModified ? "var(--tui-amber)" : "var(--tui-fg-3)",
                        width: "10ch",
                        flexShrink: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {field.label}
                      </span>
                      {field.type === "select" && field.options ? (
                        <select
                          value={displayValue}
                          onChange={e => handleChange(field.path, e.target.value)}
                          style={{
                            flex: 1,
                            padding: "0.125rem 0.25ch",
                            background: "var(--tui-bg-0)",
                            border: `1px solid ${isModified ? "var(--tui-amber-dim)" : "var(--tui-border)"}`,
                            color: isModified ? "var(--tui-amber)" : "var(--tui-fg-1)",
                            fontSize: "var(--tui-font-size-xs)",
                            fontFamily: "var(--tui-font)",
                            minWidth: 0,
                          }}
                        >
                          <option value="">—</option>
                          {field.options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="number"
                          step={field.step ?? 0.1}
                          min={field.min ?? 0}
                          max={field.max ?? 3}
                          value={displayValue}
                          onChange={e => handleChange(field.path, e.target.value)}
                          style={{
                            flex: 1,
                            padding: "0.125rem 0.25ch",
                            background: "var(--tui-bg-0)",
                            border: `1px solid ${isModified ? "var(--tui-amber-dim)" : "var(--tui-border)"}`,
                            color: isModified ? "var(--tui-amber)" : "var(--tui-fg-1)",
                            fontSize: "var(--tui-font-size-xs)",
                            fontFamily: "var(--tui-font)",
                            minWidth: 0,
                            width: "4rem",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Additional petal layers ── */}
      {run(() => {
        const layers = getNestedValue(spec, "petals.layers") as unknown[] | null;
        if (!layers || layers.length <= 1) return null;
        return (
          <div style={{ marginTop: "0.25rem" }}>
            <div style={{
              fontSize: "var(--tui-font-size-xs)",
              color: "var(--tui-fg-3)",
              padding: "0.25rem 0",
              borderTop: "1px solid var(--tui-border-dim)",
            }}>
              + {layers.length - 1} more petal layer{layers.length > 2 ? "s" : ""} (read-only)
            </div>
            {(layers.slice(1) as Array<Record<string, unknown>>).map((layer, i) => (
              <div key={i} style={{
                fontSize: "var(--tui-font-size-2xs)",
                color: "var(--tui-fg-4)",
                paddingLeft: "1.5ch",
                lineHeight: 1.8,
              }}>
                L{i + 2}: {(layer.shape as string) ?? "?"} x{(layer.count as number) ?? "?"}{" "}
                {(layer.edge_style as string) ? `[${layer.edge_style}]` : ""}
              </div>
            ))}
          </div>
        );
      })}

      {/* ── Fork action ── */}
      {modifiedCount > 0 && (
        <button
          onClick={handleFork}
          className="tui-btn tui-btn-primary"
          style={{ width: "100%", padding: "0.375rem", marginTop: "0.5rem" }}
        >
          FORK {modifiedCount} PART{modifiedCount > 1 ? "S" : ""}
        </button>
      )}

      {modifiedCount === 0 && (
        <p style={{ color: "var(--tui-fg-4)", fontSize: "var(--tui-font-size-2xs)", marginTop: "0.375rem" }}>
          Adjust values to fork parts. Forks create personal variants others can discover.
        </p>
      )}

      {/* ── Delete ── */}
      <div style={{ marginTop: "0.5rem", borderTop: "1px solid var(--tui-border-dim)", paddingTop: "0.5rem" }}>
        <button
          onClick={() => {
            conn?.reducers.deleteSession({ sessionId: BigInt(sessionId) });
          }}
          className="tui-btn tui-btn-danger"
          style={{ width: "100%", padding: "0.375rem" }}
        >
          DELETE {constituents.length > 1 ? "BUNDLE" : "FLOWER"}
        </button>
      </div>
    </div>
  );
}
