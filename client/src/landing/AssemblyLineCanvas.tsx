import { useEffect, useRef, useState } from "react";
import { startAssemblyLine } from "../gpu/startAssemblyLine.ts";
import { FALLBACK_URL, PLATES } from "./plates.ts";
import { timeline } from "./timeline.ts";

type Mode = "gpu" | "fallback";

/**
 * The animated, dithered assembly line behind the landing. Browsers without WebGPU get the
 * static composite that scripts/render-art-fallbacks.ts rendered from the same shader.
 */
export function AssemblyLineCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>("gpu");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const line = startAssemblyLine(canvas, PLATES, timeline);
    line.ready.catch((error: unknown) => {
      console.warn("Assembly line fell back to the static plate", error);
      setMode("fallback");
    });
    return () => line.stop();
  }, []);

  const fill: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    display: "block",
    pointerEvents: "none",
  };

  if (mode === "fallback") {
    return (
      <img src={FALLBACK_URL} alt="" style={{ ...fill, objectFit: "cover" }} />
    );
  }
  return <canvas ref={canvasRef} aria-hidden="true" style={fill} />;
}
