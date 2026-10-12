import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import { app } from "./app";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const envPort = Number(process.env.PORT);
const port = Number.isInteger(envPort) && envPort > 0 ? envPort : 3000;

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, () => {
  console.log(`http://127.0.0.1:${port}`);
});
