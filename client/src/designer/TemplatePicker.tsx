import { useState } from "react";
import { motion } from "motion/react";
import type { DbConnection } from "../spacetime/types.ts";
import { templatesByCategory, type TemplateInfo } from "../data/templates.ts";
import { readStreamWithProgress, parseSpec } from "../lib/utils.ts";

interface TemplatePickerProps {
  conn: DbConnection | null;
  model: string;
  onGenerationStart: (prompt: string) => string;
  onSpecProgress: (genId: string, specYaml: string) => void;
  onFlowerGenerated: (genId: string, specYaml: string) => void;
  onGenerationFailed: (genId: string) => void;
}

export function TemplatePicker({ conn, model, onGenerationStart, onSpecProgress, onFlowerGenerated, onGenerationFailed }: TemplatePickerProps) {
  const [search, setSearch] = useState("");
  const [generatingSet, setGeneratingSet] = useState<Set<string>>(new Set());
  const groups = templatesByCategory();

  const lowerSearch = search.toLowerCase();
  const filteredGroups = groups
    .map(g => ({
      ...g,
      templates: g.templates.filter(
        t =>
          t.name.toLowerCase().includes(lowerSearch) ||
          t.scientific.toLowerCase().includes(lowerSearch) ||
          t.colors.some(c => c.toLowerCase().includes(lowerSearch)) ||
          t.season.toLowerCase().includes(lowerSearch),
      ),
    }))
    .filter(g => g.templates.length > 0);

  const handleTemplateClick = async (t: TemplateInfo) => {
    if (!conn) return;
    setGeneratingSet(prev => new Set([...prev, t.name]));
    const genId = onGenerationStart(t.name);
    try {
      const res = await fetch("/api/flower/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: t.name, template_name: t.name, model }),
      });
      if (!res.ok || !res.body) {
        onGenerationFailed(genId);
        return;
      }
      const raw = await readStreamWithProgress(res, accumulated => {
        if (parseSpec(accumulated)) onSpecProgress(genId, accumulated);
      });
      if (!parseSpec(raw)) {
        onGenerationFailed(genId);
        return;
      }
      onFlowerGenerated(genId, raw);
    } catch {
      onGenerationFailed(genId);
    } finally {
      setGeneratingSet(prev => {
        const next = new Set(prev);
        next.delete(t.name);
        return next;
      });
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Search */}
      <div style={{ padding: "0.375rem 0.5ch", borderBottom: "1px solid var(--tui-border-dim)" }}>
        <div className="tui-input-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="search templates..."
            className="tui-input"
          />
        </div>
      </div>

      {/* Template grid */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "0.375rem 0.5ch",
        }}
      >
        <div className="tui-template-grid">
          {filteredGroups.map(group => [
            <div key={`cat-${group.category}`} className="tui-template-category">
              {group.label}
            </div>,
            ...group.templates.map(t => (
              <TemplateTile
                key={t.name}
                template={t}
                disabled={!conn}
                generating={generatingSet.has(t.name)}
                onClick={() => { void handleTemplateClick(t); }}
              />
            )),
          ])}
        </div>

        {filteredGroups.length === 0 && (
          <div
            style={{
              padding: "1rem 0",
              color: "var(--tui-fg-4)",
              fontSize: "var(--tui-font-size-sm)",
              textAlign: "center",
            }}
          >
            no templates match "{search}"
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateTile({
  template: t,
  disabled,
  generating,
  onClick,
}: {
  template: TemplateInfo;
  disabled: boolean;
  generating: boolean;
  onClick: () => void;
}) {
  const gradient = buildGradient(t.colors);

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className="tui-template-tile"
      data-generating={generating ? "true" : undefined}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1 }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: gradient,
          opacity: 0.18,
          transition: "opacity 0.15s ease",
          zIndex: 0,
        }}
        className="tui-template-tile__bg"
      />
      <span className="tui-template-tile__name">
        {generating ? (
          <span style={{ color: "var(--tui-purple)" }}>
            <span className="tui-generating" />
          </span>
        ) : (
          t.name
        )}
      </span>
      <div className="tui-template-tile__colors">
        {t.colors.slice(0, 5).map(c => (
          <span
            key={c}
            className="tui-template-tile__swatch"
            style={{ background: colorToHex(c) }}
          />
        ))}
      </div>
    </motion.button>
  );
}

function buildGradient(colors: string[]): string {
  const hexes = colors.slice(0, 3).map(colorToHex);
  if (hexes.length === 1) return hexes[0]!;
  if (hexes.length === 2) return `linear-gradient(135deg, ${hexes[0]}, ${hexes[1]})`;
  return `linear-gradient(135deg, ${hexes[0]}, ${hexes[1]}, ${hexes[2]})`;
}

function colorToHex(name: string): string {
  const map: Record<string, string> = {
    Red: "#ef4444",
    Pink: "#ec4899",
    White: "#f5f5f5",
    Yellow: "#eab308",
    Orange: "#f97316",
    Purple: "#a855f7",
    Lavender: "#c4b5fd",
    Blue: "#3b82f6",
    Green: "#22c55e",
    Peach: "#fdba74",
    Coral: "#fb7185",
    Brown: "#92400e",
  };
  return map[name] ?? "#737373";
}
