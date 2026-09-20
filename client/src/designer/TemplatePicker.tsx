import { useState } from "react";
import { motion } from "motion/react";
import type { DbConnection } from "../spacetime/types.ts";
import {
  templatesByCategory,
  templateArtUrl,
  type TemplateInfo,
} from "../data/templates.ts";
import { generateFlower } from "../ai/generateFlower.ts";

interface TemplatePickerProps {
  conn: DbConnection | null;
  model: string;
  onGenerationStart: (prompt: string) => string;
  onSpecProgress: (genId: string, specYaml: string) => void;
  onFlowerGenerated: (genId: string, specYaml: string) => void;
  onGenerationFailed: (genId: string) => void;
}

export function TemplatePicker({
  conn,
  model,
  onGenerationStart,
  onSpecProgress,
  onFlowerGenerated,
  onGenerationFailed,
}: TemplatePickerProps) {
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
      const result = await generateFlower({
        prompt: t.name,
        templateName: t.name,
        model,
        onSnapshot: snapshot => {
          if (!snapshot.done) onSpecProgress(genId, snapshot.spec);
        },
      });
      onFlowerGenerated(genId, result.spec);
    } catch {
      onGenerationFailed(genId);
    } finally {
      setGeneratingSet(prev => new Set([...prev].filter(n => n !== t.name)));
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
      <div
        style={{
          padding: "0.375rem 0.5ch",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="input-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates"
            className="input"
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
        <div className="template-grid">
          {filteredGroups.map(group => [
            <div key={`cat-${group.category}`} className="template-category">
              {group.label}
            </div>,
            ...group.templates.map(t => (
              <TemplateTile
                key={t.name}
                template={t}
                disabled={!conn}
                generating={generatingSet.has(t.name)}
                onClick={() => {
                  void handleTemplateClick(t);
                }}
              />
            )),
          ])}
        </div>

        {filteredGroups.length === 0 && (
          <div
            style={{
              padding: "1rem 0",
              color: "var(--text-quaternary)",
              fontSize: "var(--font-size-sm)",
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
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className="template-tile"
      data-generating={generating ? "true" : undefined}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1 }}
    >
      <img
        src={templateArtUrl(t)}
        alt={`${t.name}, one stem`}
        loading="lazy"
        className="template-tile__bg"
      />
      <span className="template-tile__name">
        {generating ? (
          <span style={{ color: "var(--accent)" }}>
            <span className="generating" />
          </span>
        ) : (
          t.name
        )}
      </span>
    </motion.button>
  );
}
