# Rendering

## Overview

The visual layer is a fullscreen PixiJS canvas behind the React UI. It renders every flower from every connected user on a shared infinite canvas. The user scrolls, zooms, and pans to explore.

## Architecture

```
SharedArrayBuffer (written by WASM every tick)
  │
  │  [x, y, rotation, scale, sprite_id, r, g, b, alpha] × N
  │
  ▼
PixiJS Renderer (reads buffer every frame)
  │
  ├── Sprite Atlas Manager (loads textures for 50+ flower types)
  │
  ├── Flower Container (one Container per session)
  │     ├── Stem sprite
  │     ├── Petal sprites (multiple per flower)
  │     ├── Leaf sprites
  │     └── Adornment sprites (wrap, ribbon, vase — if arrangement)
  │
  ├── Viewport (pan/zoom/scroll)
  │     ├── Culling: only render flowers inside viewport bounds
  │     └── LOD: distant flowers render as simplified sprites
  │
  ├── Merge Effects Layer
  │     ├── Particle burst on merge
  │     └── Glow filter on new arrangement
  │
  └── Order Ticker (scrolling feed of completed orders)
```

## The SharedArrayBuffer Bridge

The WASM physics simulation writes sprite transforms into a SharedArrayBuffer. PixiJS reads it every frame. No serialization, no message passing, no copying.

### Buffer Layout

```
Per flower (36 bytes):
  [0]  f32  x position
  [1]  f32  y position
  [2]  f32  rotation (radians)
  [3]  f32  scale
  [4]  u32  sprite_id (indexes into texture atlas)
  [5]  u8   r (color tint)
  [6]  u8   g
  [7]  u8   b
  [8]  u8   alpha

Total buffer size: 36 bytes × max_flowers
Default max_flowers: 10,000 → 360KB buffer
```

### Double Buffering

Two buffers alternate. WASM writes to buffer A while PixiJS reads buffer B, then they swap. This prevents tearing where PixiJS reads a half-updated frame.

The swap is coordinated by an atomic flag in a separate SharedArrayBuffer (1 byte). WASM sets the flag after finishing a write. PixiJS checks the flag, reads the completed buffer, and clears the flag.

## Sprite Atlas

### Structure

One texture atlas per flower type category. Each atlas is a spritesheet containing all visual variants of that category.

```
atlases/
├── common.json     # Rose, Tulip, Sunflower, etc. (12 types)
├── garden.json     # Dahlia, Ranunculus, etc. (12 types)
├── accent.json     # Baby's Breath, Eucalyptus, etc. (11 types)
├── statement.json  # Gladiolus, Protea, etc. (8 types)
├── spray.json      # Spray Rose, Mini Carnation, etc. (9 types)
└── adornments.json # Wrap, ribbon, vase, stand, etc.
```

Each atlas contains frames for:
- Base flower sprite (front-facing)
- Color tint variants (applied via PixiJS tint, not separate sprites)
- Part-level sprites (separate petal, stem, leaf for designer mode)

### Loading Strategy

1. Load `common.json` atlas immediately (most popular flowers)
2. Load remaining atlases lazily as new flower types appear on canvas
3. Use a placeholder sprite (generic flower silhouette) while loading

## Viewport

The canvas is infinite. Users pan by dragging, zoom with scroll wheel / pinch.

### Culling

PixiJS containers outside the viewport have `renderable = false`. The WASM module also knows the viewport bounds (`set_viewport()`) and sleeps rapier2d bodies outside it — no physics computation for offscreen flowers.

### Level of Detail (LOD)

At high zoom levels (zoomed out, seeing hundreds of flowers):
- Flowers render as simple colored circles instead of full sprite assemblies
- Arrangement adornments are hidden
- Text labels (flower names) disappear

At medium zoom:
- Full flower sprites render
- Adornments visible
- No text

At close zoom (zoomed in on a few flowers):
- Full detail sprites
- Adornments with custom shader effects
- Flower name + arrangement description visible
- Part-level detail (individual petals)

## Custom Shader Filters

Three PixiJS filters for premium visual touches:

### 1. Merge Glow
Applied to newly created arrangements for 2 seconds after merge. A soft radial glow that fades out.

### 2. Petal Translucency
Applied to petal sprites. Simulates light passing through thin petals. Uses a simple alpha gradient based on the sprite's angle relative to a virtual light source.

### 3. Depth Blur
Applied to the background layer. Flowers further from the viewport center get a subtle gaussian blur, creating a depth-of-field effect.

## Merge Particle Effect

When two flowers merge:

1. Both flower sprites scale down to 0 over 300ms
2. Particle burst at the collision point:
   - 20-30 particles in the dominant colors of both flowers
   - Particles arc outward then fade
   - Duration: 500ms
3. New arrangement sprite scales up from 0 to full size over 400ms
4. Merge glow filter activates on the new sprite

## Order Ticker

Completed orders scroll across the bottom of the canvas as a ticker:

```
[Sunset Harvest — 10 flowers — ordered by @user123] ← scrolls left
```

Each ticker item is a small PixiJS text + mini flower icon. Clicking it pans the viewport to that arrangement on the canvas.

## Performance Budget

Target: 60fps with 500 visible flowers on a mid-range laptop.

- PixiJS batch rendering: one draw call per texture atlas page (~6 draw calls total)
- SharedArrayBuffer reads: zero-copy, typed array view
- Viewport culling: only process visible flowers
- Physics sleeping: WASM skips offscreen bodies
- LOD: fewer sprites at high zoom levels
- Particle effects: object-pooled, max 200 particles active
