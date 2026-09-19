import { $ } from "bun";
import { parseArgs } from "node:util";
import { DATABASE, buildOptimisedModule } from "./module.ts";

const LOCAL_SERVER = "http://127.0.0.1:9300";
const READY_ATTEMPTS = 30;

const { values } = parseArgs({
  options: {
    server: { type: "string", default: LOCAL_SERVER },
    clear: { type: "boolean", default: false },
    "wait-for-local": { type: "boolean", default: false },
  },
});

async function waitForServer(attemptsLeft: number): Promise<boolean> {
  if (attemptsLeft === 0) return false;
  const ok = await fetch(`${values.server}/identity`)
    .then(() => true)
    .catch(() => false);
  if (ok) return true;
  await Bun.sleep(1000);
  return waitForServer(attemptsLeft - 1);
}

if (values["wait-for-local"] && !(await waitForServer(READY_ATTEMPTS))) {
  console.error(`SpacetimeDB not ready at ${values.server}`);
  process.exit(1);
}

const wasm = await buildOptimisedModule();
const clearFlag = values.clear ? ["--delete-data"] : [];
await $`spacetime publish ${DATABASE} --server ${values.server} --bin-path ${wasm} ${clearFlag} -y`;
console.log(`Published ${wasm} to ${values.server}`);
