import type { PointerFrame } from "./trail";

// Tracks the pointer over `element` in its own uv space. `sample()` returns this frame's
// position, last frame's position and the distance between them, for painting the trail.
export const trackPointer = (
  element: HTMLElement,
  listenOn: HTMLElement | Window = element,
) => {
  const raw = { x: 0.5, y: 0.5, inside: false };
  const last = { x: 0.5, y: 0.5 };

  const onMove = (event: Event) => {
    if (!(event instanceof PointerEvent)) return;
    const rect = element.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    if (inside) {
      raw.x = x;
      raw.y = y;
    }
    raw.inside = inside;
  };
  const onLeave = () => {
    raw.inside = false;
  };

  listenOn.addEventListener("pointermove", onMove, { passive: true });
  listenOn.addEventListener("pointerleave", onLeave);

  return {
    sample: (): PointerFrame => {
      const prevUv: [number, number] = [last.x, last.y];
      const uv: [number, number] = [raw.x, raw.y];
      const speed = Math.hypot(uv[0] - prevUv[0], uv[1] - prevUv[1]);
      last.x = raw.x;
      last.y = raw.y;
      return { uv, prevUv, speed, inside: raw.inside };
    },
    dispose: () => {
      listenOn.removeEventListener("pointermove", onMove);
      listenOn.removeEventListener("pointerleave", onLeave);
    },
  };
};
