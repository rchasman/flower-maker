import { type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

type PopoutPosition = "bottom-left" | "bottom-right" | "top-right";

interface PanelPopoutProps {
  label: string;
  open: boolean;
  onToggle: () => void;
  position: PopoutPosition;
  children: ReactNode;
  panelClassName?: string;
}

export function PanelPopout({
  label,
  open,
  onToggle,
  position,
  children,
  panelClassName,
}: PanelPopoutProps) {
  const isTop = position.startsWith("top");
  const slideDir = isTop ? -12 : 12;

  const toggle = (
    <button
      onClick={onToggle}
      className={`popout-toggle ${open ? "popout-toggle-active" : ""}`}
      title={`Toggle ${label}`}
    >
      <span>{open ? `${label} ×` : label}</span>
    </button>
  );

  return (
    <div className={`popout popout--${position}`}>
      {isTop && toggle}

      <AnimatePresence>
        {open && (
          <motion.div
            className={`popout-panel ${panelClassName ?? ""}`}
            initial={{ opacity: 0, y: slideDir, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: slideDir, scale: 0.96 }}
            transition={{ duration: 0.15 }}
          >
            <div className="popout-header">
              <span className="label" style={{ color: "var(--text-primary)" }}>
                {label}
              </span>
              <button
                onClick={onToggle}
                className="btn"
                style={{
                  padding: "0 0.5ch",
                  fontSize: "var(--font-size-xs)",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      {!isTop && toggle}
    </div>
  );
}
