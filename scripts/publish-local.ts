import { $ } from "bun";

const PORT = 9300;
const MAX_ATTEMPTS = 30;

// Poll until SpacetimeDB is ready on the static port
for (let i = 0; i < MAX_ATTEMPTS; i++) {
  const ok = await fetch(`http://127.0.0.1:${PORT}/identity`)
    .then(() => true)
    .catch(() => false);
  if (ok) {
    await $`spacetime publish flower-picker --server http://127.0.0.1:${PORT} --module-path server/spacetimedb -y`;
    console.log("✓ Module published to local SpacetimeDB");
    process.exit(0);
  }
  await Bun.sleep(1000);
}

console.error("⚠ SpacetimeDB not ready — see .logs/spacetime.log");
process.exit(1);
