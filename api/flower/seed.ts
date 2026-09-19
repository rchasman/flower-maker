// A prompt seeds the generator through FNV-1a so the same request text always
// gives the same flower. The RNG is the LCG from crates/flower-core/src/genetics.rs,
// run on BigInt so a seed means the same sequence in both languages.

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function seedFromPrompt(prompt: string): number {
  return new TextEncoder()
    .encode(prompt)
    .reduce(
      (hash, byte) => Math.imul(hash ^ byte, FNV_PRIME) >>> 0,
      FNV_OFFSET_BASIS,
    );
}

const LCG_MULTIPLIER = 6364136223846793005n;
const LCG_INCREMENT = 1442695040888963407n;
const U64_MASK = (1n << 64n) - 1n;
const OUTPUT_SHIFT = 33n;
const OUTPUT_RANGE = 2 ** 31;

export type Rng = () => number;

export function createRng(seed: number): Rng {
  let state = BigInt(seed) & U64_MASK;
  return () => {
    state = (state * LCG_MULTIPLIER + LCG_INCREMENT) & U64_MASK;
    return Number(state >> OUTPUT_SHIFT) / OUTPUT_RANGE;
  };
}
