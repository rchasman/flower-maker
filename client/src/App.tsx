import { useState } from "react";
import { SessionProvider } from "./session/SessionProvider.tsx";
import { FlowerGrid } from "./homepage/FlowerGrid.tsx";
import { DesignerView } from "./designer/DesignerView.tsx";

type View = "grid" | "designer";

export function App() {
  const [view, setView] = useState<View>("grid");

  return (
    <SessionProvider>
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        {view === "grid" ? (
          <FlowerGrid onEnterDesigner={() => setView("designer")} />
        ) : (
          <DesignerView onBackToGrid={() => setView("grid")} />
        )}
      </div>
    </SessionProvider>
  );
}
