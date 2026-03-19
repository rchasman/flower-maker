import { useState } from "react";
import type { DbConnection } from "../spacetime/types.ts";
import { templatesByCategory, type TemplateInfo } from "../data/templates.ts";
import { readStreamWithProgress } from "../lib/utils.ts";
import { parse as parseYaml } from "yaml";

interface TemplatePickerProps {
  conn: DbConnection | null;
  onGenerationStart: (prompt: string) => string;
  onSpecProgress: (genId: string, specJson: string) => void;
  onFlowerGenerated: (genId: string, specJson: string) => void;
}

function tryParseYamlToJson(raw: string): string | null {
  try {
    const parsed = parseYaml(raw);
    return parsed && typeof parsed === "object" ? JSON.stringify(parsed) : null;
  } catch {
    return null;
  }
}

export function TemplatePicker({ conn, onGenerationStart, onSpecProgress, onFlowerGenerated }: TemplatePickerProps) {
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
        body: JSON.stringify({ prompt: t.name, template_name: t.name }),
      });
      if (!res.ok || !res.body) return;
      const raw = await readStreamWithProgress(res, accumulated => {
        const specJson = tryParseYamlToJson(accumulated);
        if (specJson) onSpecProgress(genId, specJson);
      });
      const specJson = tryParseYamlToJson(raw) ?? "{}";
      onFlowerGenerated(genId, specJson);
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
      <div style={{ padding: "0.5rem", borderBottom: "1px solid #1a1a1a" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search 46 templates..."
          style={{
            width: "100%",
            padding: "0.375rem 0.5rem",
            background: "#0d0d0d",
            border: "1px solid #1a1a1a",
            borderRadius: "0.25rem",
            color: "#e5e5e5",
            fontSize: "0.6875rem",
            outline: "none",
          }}
        />
      </div>

      {/* Template list */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "0.25rem 0.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {filteredGroups.map(group => (
          <div key={group.category}>
            <div
              style={{
                fontSize: "0.5625rem",
                fontWeight: 600,
                color: "#525252",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                padding: "0.375rem 0 0.25rem",
              }}
            >
              {group.label} ({group.templates.length})
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.125rem",
              }}
            >
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
              padding: "1rem",
              color: "#404040",
              fontSize: "0.6875rem",
              textAlign: "center",
            }}
          >
            No templates match "{search}"
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
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.375rem 0.5rem",
        background: generating ? "#1a1a2e" : "#141414",
        border: `1px solid ${generating ? "#2d2d5e" : "#1a1a1a"}`,
        borderRadius: "0.25rem",
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        color: "#e5e5e5",
        opacity: disabled && !generating ? 0.5 : 1,
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 500 }}>
          {generating ? `Generating ${t.name}...` : t.name}
        </div>
        <div
          style={{
            fontSize: "0.5625rem",
            color: "#525252",
            fontStyle: "italic",
          }}
        >
          {t.scientific}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: "2px",
          flexShrink: 0,
        }}
      >
        {t.colors.slice(0, 4).map(c => (
          <span
            key={c}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: colorToHex(c),
              border: "1px solid #262626",
            }}
          />
        ))}
        {t.colors.length > 4 && (
          <span
            style={{ fontSize: "0.5rem", color: "#404040", lineHeight: "6px" }}
          >
            +{t.colors.length - 4}
          </span>
        )}
      </div>
    </button>
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
