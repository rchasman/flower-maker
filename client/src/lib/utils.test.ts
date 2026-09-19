import { describe, expect, test } from "bun:test";
import {
  getNestedValue,
  parseSpec,
  readNdjson,
  setNestedValue,
} from "./utils.ts";

const FLAT_SYMMETRY_SPEC = `
name: Rose
petals:
  layers: []
  symmetry: Radial
  symmetry_order: 5
`;

describe("parseSpec", () => {
  test("reads the flat symmetry form", () => {
    const spec = parseSpec(FLAT_SYMMETRY_SPEC);
    expect(spec?.petals).toEqual({
      layers: [],
      symmetry: "Radial",
      symmetry_order: 5,
    });
  });

  test("returns null for empty input", () => {
    const missing: string | undefined = undefined;
    expect(parseSpec("{}")).toBeNull();
    expect(parseSpec("   ")).toBeNull();
    expect(parseSpec(missing)).toBeNull();
  });

  test("returns null for a scalar document", () => {
    expect(parseSpec("just a string")).toBeNull();
  });
});

describe("setNestedValue", () => {
  test("sets a field on an existing array element and keeps the array", () => {
    const spec = {
      petals: { layers: [{ shape: "Ovate" }, { shape: "Oblong" }] },
    };
    const result = setNestedValue(spec, "petals.layers.0.shape", "Cordate");
    expect(result).toEqual({
      petals: { layers: [{ shape: "Cordate" }, { shape: "Oblong" }] },
    });
    expect(getNestedValue(result, "petals.layers")).toBeInstanceOf(Array);
  });

  test("creates the array and the element when missing", () => {
    expect(setNestedValue({}, "structure.buds.0.size", 0.4)).toEqual({
      structure: { buds: [{ size: 0.4 }] },
    });
  });

  test("pads with empty elements when the index is past the end", () => {
    expect(setNestedValue({ list: [{ a: 1 }] }, "list.2.b", 2)).toEqual({
      list: [{ a: 1 }, {}, { b: 2 }],
    });
  });

  test("leaves an array untouched when a named key targets it", () => {
    const spec = { structure: { sepals: [{ length: 0.5 }] } };
    expect(setNestedValue(spec, "structure.sepals.length", 0.9)).toEqual(spec);
  });

  test("replaces a scalar on the way with an object", () => {
    expect(setNestedValue({ a: 3 }, "a.b", 1)).toEqual({ a: { b: 1 } });
  });

  test("does not mutate the input", () => {
    const spec = { petals: { layers: [{ shape: "Ovate" }] } };
    setNestedValue(spec, "petals.layers.0.shape", "Cordate");
    expect(spec).toEqual({ petals: { layers: [{ shape: "Ovate" }] } });
  });
});

type Line = { n: number; text?: string };

function chunkedResponse(chunks: readonly string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body);
}

describe("readNdjson", () => {
  test("joins a line split across chunk boundaries", async () => {
    const seen: Line[] = [];
    const lines = await readNdjson<Line>(
      chunkedResponse(['{"n":1,"te', 'xt":"a"}\n{"n":', "2}\n"]),
      line => seen.push(line),
    );
    expect(lines).toEqual([{ n: 1, text: "a" }, { n: 2 }]);
    expect(seen).toEqual(lines);
  });

  test("parses a trailing line without a newline", async () => {
    const lines = await readNdjson<Line>(
      chunkedResponse(['{"n":1}\n', '{"n":2}']),
      () => {},
    );
    expect(lines).toEqual([{ n: 1 }, { n: 2 }]);
  });

  test("ignores empty lines", async () => {
    const lines = await readNdjson<Line>(
      chunkedResponse(['\n{"n":1}\n\n', '  \n{"n":2}\n\n']),
      () => {},
    );
    expect(lines).toEqual([{ n: 1 }, { n: 2 }]);
  });

  test("calls onLine once per line, in order, as each newline lands", async () => {
    const order: number[] = [];
    await readNdjson<Line>(
      chunkedResponse(['{"n":1}\n{"n":2}\n', '{"n":3}\n']),
      line => order.push(line.n),
    );
    expect(order).toEqual([1, 2, 3]);
  });

  test("resolves with no lines when the response has no body", async () => {
    expect(await readNdjson<Line>(new Response(null), () => {})).toEqual([]);
  });
});
