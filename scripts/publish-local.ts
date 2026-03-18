import { $ } from "bun";

const MAX_ATTEMPTS = 30;

// Poll portless list for the real SpacetimeDB port
let port = "";
for (let i = 0; i < MAX_ATTEMPTS; i++) {
  const list = await $`portless list 2>/dev/null`.text().catch(() => "");
  const match = list.match(/db\.flower-maker.*->.*localhost:(\d+)/);
  if (match) {
    const candidate = match[1];
    const ok = await fetch(`http://127.0.0.1:${candidate}/identity`)
      .then(() => true)
      .catch(() => false);
    if (ok) {
      port = candidate;
      break;
    }
  }
  await Bun.sleep(1000);
}

if (!port) {
  console.error("⚠ SpacetimeDB not ready — see .logs/spacetime.log");
  process.exit(1);
}

await $`spacetime publish flower-picker --server http://127.0.0.1:${port} --module-path server/spacetimedb -y`;
console.log("✓ Module published to local SpacetimeDB");
