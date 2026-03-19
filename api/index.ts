import { handleGenerate } from "./flower/generate";
import { handleCombine } from "./flower/combine";
import { handleOrder } from "./flower/order";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const routes: Record<string, (req: Request) => Promise<Response>> = {
  "/flower/generate": handleGenerate,
  "/flower/combine": handleCombine,
  "/flower/order": handleOrder,
};

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, "");
    const route = routes[path];

    if (!route) {
      return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
    }

    const response = await route(request);
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  },
};
