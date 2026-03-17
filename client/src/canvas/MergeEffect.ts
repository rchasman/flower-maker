/**
 * Merge particle effect — triggered when two flowers combine.
 *
 * Spawns a burst of colored particles at the merge point,
 * arcing outward then fading. Uses the dominant colors of both
 * parent flowers.
 *
 * This is a pure data model — the PixiJS renderer reads it
 * each frame and draws the particles.
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0.0 = dead, 1.0 = just spawned
  maxLife: number;
  color: number; // hex color for PixiJS tint
  scale: number;
}

export interface MergeEffectState {
  particles: Particle[];
  active: boolean;
}

const PARTICLE_COUNT = 24;
const BURST_SPEED = 150;
const LIFETIME = 0.8;

export function createMergeEffect(
  x: number,
  y: number,
  colorA: number,
  colorB: number,
): MergeEffectState {
  const particles: Particle[] = Array.from(
    { length: PARTICLE_COUNT },
    (_, i) => {
      const angle =
        (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = BURST_SPEED * (0.6 + Math.random() * 0.8);
      const color = i % 2 === 0 ? colorA : colorB;

      return {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        maxLife: LIFETIME * (0.8 + Math.random() * 0.4),
        color,
        scale: 0.5 + Math.random() * 0.5,
      };
    },
  );

  return { particles, active: true };
}

export function tickMergeEffect(effect: MergeEffectState, dt: number): void {
  let anyAlive = false;

  for (const p of effect.particles) {
    if (p.life <= 0) continue;

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.95; // drag
    p.vy *= 0.95;
    p.life -= dt / p.maxLife;
    p.scale *= 0.98;

    if (p.life > 0) anyAlive = true;
  }

  effect.active = anyAlive;
}
