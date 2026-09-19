import { $ } from "bun";
import { parseArgs } from "node:util";

// The spacetime CLI optimises modules with `wasm-opt -all`, and binaryen 132
// emits a binary under `-all` that the SpacetimeDB server cannot parse. Build,
// optimise without `-all`, and publish the resulting file by path instead.

const MODULE_PATH = "server/spacetimedb";
const DATABASE = "flower-picker";
const RAW_WASM = "target/wasm32-unknown-unknown/release/server.wasm";
const OPT_WASM = "target/wasm32-unknown-unknown/release/server.publish.wasm";
const LOCAL_SERVER = "http://127.0.0.1:9300";
const READY_ATTEMPTS = 30;

const { values } = parseArgs({
  options: {
    server: { type: "string", default: LOCAL_SERVER },
    clear: { type: "boolean", default: false },
    "wait-for-local": { type: "boolean", default: false },
  },
});

async function waitForLocalServer(): Promise<boolean> {
  const attempts = Array.from({ length: READY_ATTEMPTS }, (_, i) => i);
  return attempts.reduce<Promise<boolean>>(async (ready, _) => {
    if (await ready) return true;
    const ok = await fetch(`${values.server}/identity`)
      .then(() => true)
      .catch(() => false);
    if (!ok) await Bun.sleep(1000);
    return ok;
  }, Promise.resolve(false));
}

async function optimise(): Promise<string> {
  if (!Bun.which("wasm-opt")) {
    console.warn("wasm-opt not found, publishing the unoptimised module");
    return RAW_WASM;
  }
  await $`wasm-opt -g -O2 ${RAW_WASM} -o ${OPT_WASM}`;
  return OPT_WASM;
}

if (values["wait-for-local"] && !(await waitForLocalServer())) {
  console.error(`SpacetimeDB not ready at ${values.server}`);
  process.exit(1);
}

await $`spacetime build --module-path ${MODULE_PATH}`;
const wasm = await optimise();
const clearFlag = values.clear ? ["--delete-data"] : [];
await $`spacetime publish ${DATABASE} --server ${values.server} --bin-path ${wasm} ${clearFlag} -y`;
console.log(`Published ${wasm} to ${values.server}`);
