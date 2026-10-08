import express from "express";
import { createServer } from "node:http";
import { createServer as createVite } from "vite";
import { api, port } from "./api.mjs";
const app = express(),
  server = createServer(app);
api(app);
const vite = await createVite({
  server: { middlewareMode: true, hmr: { server } },
  appType: "spa",
});
app.use(vite.middlewares);
server.listen(port, "0.0.0.0", () =>
  console.log(`YEN development listening on port ${port}`),
);
