# Rendering

## Two Rendering Contexts

### Homepage Grid
PixiJS virtualized grid of all user zones. Each zone is a thumbnail rendered from SpacetimeDB subscription data. No physics — pure display. Your zone is centered and highlighted.

### Designer Canvas
PixiJS canvas with WASM-driven physics. Only runs for YOUR zone when you enter the designer. rapier2d rigid bodies per flower, collision detection for merges, bloom-in/wilt-out animations.

## WASM → PixiJS Bridge

The game loop (`wasm/loop.ts`) runs at 60fps:
1. `sim.tick(dt)` advances rapier2d physics + animations
2. `sim.get_merge_events()` checks for collision-based merges
3. `sim.render_data()` exports per-flower transforms as JSON

PixiJS reads the render data and updates sprite positions each frame.

## Animations

- **Bloom-in**: scale 0→1 with ease-out-back (bouncy overshoot) over 2 seconds
- **Wilt-out**: scale 1→0 with ease-in-back (pull-back exit) over 2 seconds
- **Particles**: pollen, fireflies, stardust — emitted during the Alive state from OrnamentationSystem effects

## Future: Custom Shaders

Three planned PixiJS filters:
1. MergeGlow — soft radial glow on new arrangements
2. PetalTranslucency — alpha gradient based on virtual light angle
3. DepthBlur — gaussian blur on flowers far from viewport center
