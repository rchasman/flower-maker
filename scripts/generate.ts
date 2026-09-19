import { $ } from "bun";
import { BINDINGS_DIR, buildOptimisedModule } from "./module.ts";

const wasm = await buildOptimisedModule();
await $`spacetime generate --lang typescript --out-dir ${BINDINGS_DIR} --bin-path ${wasm}`;
console.log(`Generated bindings in ${BINDINGS_DIR} from ${wasm}`);
