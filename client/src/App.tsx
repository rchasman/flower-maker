import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SessionProvider } from "./session/SessionProvider.tsx";
import { NameGate } from "./session/NameGate.tsx";
import { FlowerGrid } from "./homepage/FlowerGrid.tsx";
import { DesignerView } from "./designer/DesignerView.tsx";

type View = "grid" | "designer";

export function App() {
  const [view, setView] = useState<View>("grid");

  return (
    <SessionProvider>
      <NameGate>
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          <AnimatePresence mode="wait">
            {view === "grid" ? (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ width: "100%", height: "100%" }}
              >
                <FlowerGrid onEnterDesigner={() => setView("designer")} />
              </motion.div>
            ) : (
              <motion.div
                key="designer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ width: "100%", height: "100%" }}
              >
                <DesignerView onBackToGrid={() => setView("grid")} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Atmospheric layers */}
          <div className="tui-dotgrid" />
          <div className="tui-vignette" />
          <div className="tui-scanlines" />
        </div>
      </NameGate>
    </SessionProvider>
  );
}
