import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "@hono/node-server/vercel";
import { flowerRoutes } from "./src/routes/flower.ts";

const app = new Hono();

app.use("/*", cors());
app.route("/flower", flowerRoutes);

app.get("/health", c => c.json({ status: "ok" }));

export default app;
export const GET = handle(app);
export const POST = handle(app);
