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
  spinSpeed: number; // radial velocity for spiral motion
}

export interface MergeEffectState {
  particles: Particle[];
  active: boolean;
}

const PARTICLE_COUNT = 48;
const BURST_SPEED = 200;
const LIFETIME = 1.2;

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
        scale: 0.3 + Math.random() * 0.9,
        spinSpeed: (Math.random() - 0.5) * 4,
      };
    },
  );

  return { particles, active: true };
}

export function tickMergeEffect(effect: MergeEffectState, dt: number): void {
  let anyAlive = false;

  for (const p of effect.particles) {
    if (p.life <= 0) continue;

    // Rotate velocity to create spiral trajectories
    const cos = Math.cos(p.spinSpeed * dt);
    const sin = Math.sin(p.spinSpeed * dt);
    const nvx = p.vx * cos - p.vy * sin;
    const nvy = p.vx * sin + p.vy * cos;
    p.vx = nvx;
    p.vy = nvy;

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.95; // drag
    p.vy *= 0.95;
    p.vy += 30 * dt; // gentle downward pull
    p.life -= dt / p.maxLife;
    p.scale *= 0.98;

    if (p.life > 0) anyAlive = true;
  }

  effect.active = anyAlive;
}
