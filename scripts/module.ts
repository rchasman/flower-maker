import { $ } from "bun";

// The spacetime CLI optimises modules with `wasm-opt -all`, and binaryen 132
// emits a binary under `-all` that SpacetimeDB cannot parse. Build, then
// optimise without `-all`, and hand the resulting file to the CLI by path.

const MODULE_PATH = "server/spacetimedb";
const RAW_WASM = "target/wasm32-unknown-unknown/release/server.wasm";
const OPT_WASM = "target/wasm32-unknown-unknown/release/server.publish.wasm";

export const DATABASE = "flower-picker";
export const BINDINGS_DIR = "client/src/spacetime/module_bindings";

export async function buildOptimisedModule(): Promise<string> {
  await $`spacetime build --module-path ${MODULE_PATH}`;
  if (!Bun.which("wasm-opt")) {
    console.warn("wasm-opt not found, using the unoptimised module");
    return RAW_WASM;
  }
  await $`wasm-opt -g -O2 ${RAW_WASM} -o ${OPT_WASM}`;
  return OPT_WASM;
}
