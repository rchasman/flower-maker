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
      {/* Header */}
      <div
        style={{
          padding: "0.375rem 1ch",
          borderBottom: "1px solid var(--tui-border)",
          fontSize: "var(--tui-font-size-xs)",
          color: "var(--tui-green)",
        }}
      >
        ── TEMPLATES
      </div>

      {/* Search */}
      <div style={{ padding: "0.375rem 0.5ch", borderBottom: "1px solid var(--tui-border-dim)" }}>
        <div className="tui-input-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="search 46 templates..."
            className="tui-input"
          />
        </div>
      </div>

      {/* Template list */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "0.25rem 0.5ch",
          display: "flex",
          flexDirection: "column",
          gap: "0.375rem",
        }}
      >
        {filteredGroups.map(group => (
          <div key={group.category}>
            <div
              style={{
                fontSize: "var(--tui-font-size-2xs)",
                fontWeight: 600,
                color: "var(--tui-fg-3)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "0.375rem 0 0.125rem",
              }}
            >
              {group.label} ({group.templates.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              {group.templates.map(t => (
                <TemplateRow
                  key={t.name}
                  template={t}
                  disabled={!conn}
                  generating={generatingSet.has(t.name)}
                  onClick={() => { void handleTemplateClick(t); }}
                />
              ))}
            </div>
          </div>
        ))}

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

function TemplateRow({
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
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className="tui-template-row"
      data-generating={generating ? "true" : undefined}
      whileHover={{ x: 2 }}
      transition={{ duration: 0.1 }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--tui-font-size-sm)", fontWeight: 500 }}>
          {generating ? (
            <span style={{ color: "var(--tui-purple)" }}>
              generating {t.name}<span className="tui-generating" />
            </span>
          ) : (
            t.name
          )}
        </div>
        <div
          style={{
            fontSize: "var(--tui-font-size-2xs)",
            color: "var(--tui-fg-4)",
            fontStyle: "italic",
          }}
        >
          {t.scientific}
        </div>
      </div>
      <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
        {t.colors.slice(0, 4).map(c => (
          <span
            key={c}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: colorToHex(c),
              border: "1px solid var(--tui-border)",
              display: "inline-block",
            }}
          />
        ))}
        {t.colors.length > 4 && (
          <span style={{ fontSize: "0.5rem", color: "var(--tui-fg-4)", lineHeight: "6px" }}>
            +{t.colors.length - 4}
          </span>
        )}
      </div>
    </motion.button>
  );
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
