import { useState } from "react";
import { useSession } from "../session/SessionProvider.tsx";
import { run, getNestedValue, isRecord, parseSpec } from "../lib/utils.ts";
import {
  AURA_KINDS,
  BIO_PATTERNS,
  BRANCH_PATTERNS,
  DEWDROP_PLACEMENTS,
  DISPERSAL_PATTERNS,
  EDGE_STYLES,
  FLOWER_FAMILIES,
  FUSION_KINDS,
  INFLORESCENCE_KINDS,
  LEAF_SHAPES,
  LIFE_STAGES,
  NECTARY_POSITIONS,
  PARTICLE_KINDS,
  PATTERN_KINDS,
  PETAL_ARRANGEMENTS,
  PETAL_SHAPES,
  SERRATIONS,
  SIDES,
  SURFACE_TEXTURES,
  SYMMETRIES,
  VARIEGATION_KINDS,
} from "../data/flower-enums.ts";

interface ConstituentInfo {
  index: number;
  spec: string;
  forkedFrom: string;
}

interface PartEditorProps {
  sessionId: number;
  spec: string;
  constituents?: ConstituentInfo[];
}

// ── Field schema ───────────────────────────────────────────────────────────
// Every path is one the renderer reads (client/src/flower/render.ts).

type NumberField = {
  path: string;
  label: string;
  type: "number";
  min: number;
  max: number;
  step: number;
};
type SelectField = {
  path: string;
  label: string;
  type: "select";
  options: readonly string[];
};
type BooleanField = { path: string; label: string; type: "boolean" };
type ColorField = { path: string; label: string; type: "color" };
type FieldDef = NumberField | SelectField | BooleanField | ColorField;

type TaxonomySection = {
  key: string;
  label: string;
  accent: string;
  fields: FieldDef[];
};

const num = (
  path: string,
  label: string,
  min: number,
  max: number,
  step: number,
): NumberField => ({ path, label, type: "number", min, max, step });
const unit = (path: string, label: string): NumberField =>
  num(path, label, 0, 1, 0.05);
const pick = (
  path: string,
  label: string,
  options: readonly string[],
): SelectField => ({ path, label, type: "select", options });
const flag = (path: string, label: string): BooleanField => ({
  path,
  label,
  type: "boolean",
});
const color = (path: string, label: string): ColorField => ({
  path,
  label,
  type: "color",
});

const BOOLEAN_OPTIONS: readonly string[] = ["true", "false"];

const TAXONOMY: TaxonomySection[] = [
  {
    key: "petals",
    label: "PETALS",
    accent: "var(--tui-purple)",
    fields: [
      pick("petals.layers.0.shape", "shape", PETAL_SHAPES),
      pick("petals.layers.0.arrangement", "arrangement", PETAL_ARRANGEMENTS),
      num("petals.layers.0.count", "count", 1, 60, 1),
      num("petals.layers.0.length", "length", 0.1, 5, 0.05),
      num("petals.layers.0.width", "width", 0.1, 3, 0.05),
      num("petals.layers.0.curvature", "curvature", -1, 1, 0.05),
      unit("petals.layers.0.curl", "curl"),
      unit("petals.layers.0.droop", "droop"),
      unit("petals.layers.0.opacity", "opacity"),
      num("petals.layers.0.angular_offset", "angular offset", 0, 360, 5),
      pick("petals.layers.0.edge_style", "edge style", EDGE_STYLES),
      pick("petals.layers.0.pattern.kind", "pattern", PATTERN_KINDS),
      color("petals.layers.0.pattern.color", "pattern color"),
      unit("petals.layers.0.pattern.scale", "mark scale"),
      unit("petals.layers.0.pattern.density", "mark density"),
      unit("petals.layers.0.pattern.extent", "mark extent"),
      pick("petals.layers.0.fusion.kind", "fusion", FUSION_KINDS),
      unit("petals.layers.0.fusion.depth", "fusion depth"),
      pick("petals.stage", "stage", LIFE_STAGES),
    ],
  },
  {
    key: "structure",
    label: "STRUCTURE",
    accent: "var(--tui-green)",
    fields: [
      num("structure.stem.height", "stem height", 0, 3, 0.05),
      num("structure.stem.thickness", "stem width", 0, 1, 0.02),
      unit("structure.stem.curvature", "stem curve"),
      pick("structure.stem.surface", "stem surface", SURFACE_TEXTURES),
      pick("structure.stem.branching", "branching", BRANCH_PATTERNS),
      color("structure.stem.color", "stem color"),
      num("structure.stem.thorns.density", "thorn density", 0, 1, 0.1),
      unit("structure.stem.thorns.size", "thorn size"),
      num("structure.sepals.0.length", "sepal length", 0, 2, 0.05),
      num("structure.receptacle.size", "receptacle", 0, 2, 0.05),
      pick("inflorescence.kind", "heads", INFLORESCENCE_KINDS),
      num("inflorescence.head_count", "head count", 1, 30, 1),
      unit("inflorescence.head_scale", "head scale"),
      unit("inflorescence.spread", "head spread"),
      unit("structure.buds.0.position", "bud position"),
      pick("structure.buds.0.side", "bud side", SIDES),
      unit("structure.buds.0.size", "bud size"),
      unit("structure.buds.0.openness", "bud openness"),
    ],
  },
  {
    key: "reproductive",
    label: "REPRODUCTIVE",
    accent: "var(--tui-amber)",
    fields: [
      num("reproductive.stamens.0.height", "stamen height", 0, 2, 0.05),
      num("reproductive.pistil.height", "pistil height", 0, 2, 0.05),
      num("reproductive.pollen.particle_count", "pollen count", 0, 200, 1),
      unit("reproductive.pollen.drift_speed", "pollen drift"),
      unit("reproductive.pollen.luminosity", "pollen glow"),
      pick("reproductive.pollen.dispersal", "dispersal", DISPERSAL_PATTERNS),
      pick("reproductive.nectary.position", "nectary", NECTARY_POSITIONS),
    ],
  },
  {
    key: "foliage",
    label: "FOLIAGE",
    accent: "var(--tui-green)",
    fields: [
      pick("foliage.leaves.0.shape", "leaf shape", LEAF_SHAPES),
      pick("foliage.leaves.0.serration", "serration", SERRATIONS),
      unit("foliage.leaves.0.translucency", "translucency"),
      pick(
        "foliage.leaves.0.variegation.kind",
        "variegation",
        VARIEGATION_KINDS,
      ),
      color("foliage.leaves.0.variegation.color", "varieg. color"),
      flag("foliage.bracts.0.showy", "showy bract"),
      unit("foliage.bracts.0.size", "bract size"),
      pick("foliage.bracts.0.shape", "bract shape", LEAF_SHAPES),
    ],
  },
  {
    key: "effects",
    label: "EFFECTS",
    accent: "var(--tui-cyan)",
    fields: [
      pick("aura.kind", "aura", AURA_KINDS),
      unit("aura.opacity", "aura opacity"),
      num("aura.radius", "aura radius", 0, 3, 0.1),
      pick("ornamentation.particles.0.kind", "particles", PARTICLE_KINDS),
      num("ornamentation.particles.0.density", "particle density", 0, 50, 1),
      num("ornamentation.particles.0.drift_speed", "drift speed", 0, 2, 0.1),
      num("ornamentation.particles.0.gravity", "gravity", -1, 1, 0.05),
      num("ornamentation.dewdrops.0.count", "dewdrops", 0, 20, 1),
      unit("ornamentation.dewdrops.0.size", "dew size"),
      pick(
        "ornamentation.dewdrops.0.placement",
        "dew placement",
        DEWDROP_PLACEMENTS,
      ),
      unit("ornamentation.iridescence.intensity", "iridescence"),
      num("ornamentation.iridescence.hue_shift_range", "hue shift", 0, 180, 5),
      pick("ornamentation.bioluminescence.pattern", "biolum.", BIO_PATTERNS),
      unit("ornamentation.bioluminescence.intensity", "biolum. glow"),
    ],
  },
  {
    key: "symmetry",
    label: "SYMMETRY",
    accent: "var(--tui-blue)",
    fields: [
      pick("petals.symmetry", "type", SYMMETRIES),
      num("petals.symmetry_order", "order", 0, 20, 1),
      num("petals.divergence_angle", "divergence", 0, 360, 0.5),
    ],
  },
  {
    key: "taxonomy",
    label: "TAXONOMY",
    accent: "var(--tui-blue)",
    fields: [pick("taxonomy.family", "family", FLOWER_FAMILIES)],
  },
];

const FIELD_BY_PATH = new Map<string, FieldDef>(
  TAXONOMY.flatMap(section => section.fields).map(field => [field.path, field]),
);

// ── Value encoding ─────────────────────────────────────────────────────────
// Overrides travel as strings; these map between them and typed spec values.

type SpecColor = { r: number; g: number; b: number; a: number };

const channelHex = (value: unknown): string => {
  const channel =
    typeof value === "number" ? Math.min(1, Math.max(0, value)) : 0;
  return Math.round(channel * 255)
    .toString(16)
    .padStart(2, "0");
};

const colorToHexString = (value: unknown): string | null =>
  isRecord(value)
    ? `#${channelHex(value.r)}${channelHex(value.g)}${channelHex(value.b)}`
    : null;

function hexStringToColor(hex: string): SpecColor | undefined {
  const digits = /^#([0-9a-f]{6})$/i.exec(hex)?.[1];
  if (digits === undefined) return undefined;
  const packed = parseInt(digits, 16);
  return {
    r: ((packed >> 16) & 0xff) / 255,
    g: ((packed >> 8) & 0xff) / 255,
    b: (packed & 0xff) / 255,
    a: 1,
  };
}

/**
 * The typed spec value for a stored override, or undefined when the path is
 * not an editor field or the value does not fit the field.
 */
export function decodeOverride(path: string, raw: string): unknown {
  const field = FIELD_BY_PATH.get(path);
  if (!field || raw === "") return undefined;
  switch (field.type) {
    case "number": {
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
    }
    case "boolean":
      return BOOLEAN_OPTIONS.includes(raw) ? raw === "true" : undefined;
    case "select":
      return field.options.includes(raw) ? raw : undefined;
    case "color":
      return hexStringToColor(raw);
  }
}

const isPrimitive = (value: unknown): value is string | number | boolean =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

function displayValueFor(field: FieldDef, current: unknown): string {
  if (field.type === "color") return colorToHexString(current) ?? "#000000";
  return isPrimitive(current) ? String(current) : "";
}

const firstString = (
  record: Record<string, unknown>,
  keys: readonly string[],
): string | null =>
  keys
    .map(key => record[key])
    .find((value): value is string => typeof value === "string") ?? null;

const stringOr = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;

// ── Field input ────────────────────────────────────────────────────────────

type FieldInputProps = {
  field: FieldDef;
  value: string;
  isModified: boolean;
  onChange: (value: string) => void;
};

function FieldInput({ field, value, isModified, onChange }: FieldInputProps) {
  const style = {
    flex: 1,
    padding: "0.125rem 0.25ch",
    background: "var(--tui-bg-0)",
    border: `1px solid ${isModified ? "var(--tui-amber-dim)" : "var(--tui-border)"}`,
    color: isModified ? "var(--tui-amber)" : "var(--tui-fg-1)",
    fontSize: "var(--tui-font-size-xs)",
    fontFamily: "var(--tui-font)",
    minWidth: 0,
  };

  if (field.type === "select" || field.type === "boolean") {
    const options = field.type === "select" ? field.options : BOOLEAN_OPTIONS;
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={style}
      >
        <option value="">—</option>
        {options.map(opt => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "color") {
    return (
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...style, width: "4rem", padding: 0 }}
      />
    );
  }

  return (
    <input
      type="number"
      step={field.step}
      min={field.min}
      max={field.max}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ ...style, width: "4rem" }}
    />
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function PartEditor({
  sessionId,
  spec: specRaw,
  constituents = [],
}: PartEditorProps) {
  const { conn } = useSession();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const spec = parseSpec(specRaw) ?? {};
  const specName = firstString(spec, ["name", "common_name"]);
  const species = firstString(spec, ["species"]);

  const toggleSection = (key: string) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const handleChange = (path: string, value: string) => {
    setOverrides(prev =>
      value === ""
        ? Object.fromEntries(
            Object.entries(prev).filter(([key]) => key !== path),
          )
        : { ...prev, [path]: value },
    );
  };

  const handleFork = () => {
    if (!conn || Object.keys(overrides).length === 0) return;

    void Promise.all(
      Object.entries(overrides).map(([path, value]) =>
        conn.reducers.forkPart({
          sessionId: BigInt(sessionId),
          partPath: path,
          overrideJson: value,
          forkedFrom: path,
        }),
      ),
    );

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
          {constituents.map(c => {
            const cSpec = parseSpec(c.spec) ?? {};
            const name =
              firstString(cSpec, ["name", "common_name", "species"]) ??
              `Flower ${c.index}`;
            const shape = getNestedValue(cSpec, "petals.layers.0.shape");
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
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.1rem",
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span style={{ color: "var(--tui-fg-1)" }}>
                    {name}
                    {c.index === 0 && (
                      <span
                        className="tui-badge tui-badge-green"
                        style={{ marginLeft: "0.5ch", verticalAlign: "middle" }}
                      >
                        hero
                      </span>
                    )}
                  </span>
                  {typeof shape === "string" && (
                    <span
                      style={{
                        color: "var(--tui-fg-4)",
                        fontSize: "var(--tui-font-size-xs)",
                      }}
                    >
                      {shape}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
                  <button
                    onClick={() => {
                      void conn?.reducers.splitConstituent({
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
                      void conn?.reducers.removeConstituent({
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
        {specName !== null && (
          <div
            style={{
              color: "var(--tui-fg-0)",
              fontSize: "var(--tui-font-size-sm)",
              fontWeight: 600,
            }}
          >
            {specName}
          </div>
        )}
        {species !== null && (
          <div
            style={{
              color: "var(--tui-fg-3)",
              fontSize: "var(--tui-font-size-xs)",
              fontStyle: "italic",
            }}
          >
            {species}
          </div>
        )}
      </div>

      {/* ── Taxonomy sections ── */}
      {TAXONOMY.map(section => {
        const isCollapsed = collapsed[section.key] ?? false;
        const sectionModified = section.fields.filter(
          field => overrides[field.path] !== undefined,
        ).length;

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
              <span
                style={{
                  color: "var(--tui-fg-4)",
                  width: "1.5ch",
                  textAlign: "center",
                }}
              >
                {isCollapsed ? "▸" : "▾"}
              </span>
              <span style={{ textShadow: `0 0 6px ${section.accent}33` }}>
                {section.label}
              </span>
              {sectionModified > 0 && (
                <span
                  style={{
                    marginLeft: "auto",
                    color: "var(--tui-amber)",
                    fontSize: "var(--tui-font-size-2xs)",
                  }}
                >
                  {sectionModified} modified
                </span>
              )}
            </button>

            {/* Fields */}
            {!isCollapsed && (
              <div
                style={{
                  paddingLeft: "1.5ch",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.1875rem",
                }}
              >
                {section.fields.map(field => {
                  const overrideValue = overrides[field.path];
                  const displayValue =
                    overrideValue ??
                    displayValueFor(field, getNestedValue(spec, field.path));
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
                      <span
                        style={{
                          color: isModified
                            ? "var(--tui-amber)"
                            : "var(--tui-fg-3)",
                          width: "10ch",
                          flexShrink: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {field.label}
                      </span>
                      <FieldInput
                        field={field}
                        value={displayValue}
                        isModified={isModified}
                        onChange={value => handleChange(field.path, value)}
                      />
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
        const rawLayers = getNestedValue(spec, "petals.layers");
        const layers: unknown[] = Array.isArray(rawLayers) ? rawLayers : [];
        if (layers.length <= 1) return null;
        return (
          <div style={{ marginTop: "0.25rem" }}>
            <div
              style={{
                fontSize: "var(--tui-font-size-xs)",
                color: "var(--tui-fg-3)",
                padding: "0.25rem 0",
                borderTop: "1px solid var(--tui-border-dim)",
              }}
            >
              + {layers.length - 1} more petal layer
              {layers.length > 2 ? "s" : ""} (read-only)
            </div>
            {layers.slice(1).map((rawLayer, i) => {
              const layer = isRecord(rawLayer) ? rawLayer : {};
              const count =
                typeof layer.count === "number" ? String(layer.count) : "?";
              const edge =
                typeof layer.edge_style === "string"
                  ? `[${layer.edge_style}]`
                  : "";
              return (
                <div
                  key={i}
                  style={{
                    fontSize: "var(--tui-font-size-2xs)",
                    color: "var(--tui-fg-4)",
                    paddingLeft: "1.5ch",
                    lineHeight: 1.8,
                  }}
                >
                  L{i + 2}: {stringOr(layer.shape, "?")} x{count} {edge}
                </div>
              );
            })}
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
        <p
          style={{
            color: "var(--tui-fg-4)",
            fontSize: "var(--tui-font-size-2xs)",
            marginTop: "0.375rem",
          }}
        >
          Adjust values to fork parts. Forks create personal variants others can
          discover.
        </p>
      )}

      {/* ── Delete ── */}
      <div
        style={{
          marginTop: "0.5rem",
          borderTop: "1px solid var(--tui-border-dim)",
          paddingTop: "0.5rem",
        }}
      >
        <button
          onClick={() => {
            void conn?.reducers.deleteSession({ sessionId: BigInt(sessionId) });
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
