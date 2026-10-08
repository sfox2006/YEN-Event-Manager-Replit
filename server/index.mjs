import express from "express";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { api, port } from "./api.mjs";
const dist = fileURLToPath(new URL("../dist/", import.meta.url));
if (!existsSync(dist + "index.html"))
  throw new Error("Missing dist. Run npm run build before npm start.");
const app = express();
api(app);
app.use(express.static(dist));
app.get("/{*splat}", (_req, res) => res.sendFile(dist + "index.html"));
app.listen(port, "0.0.0.0", () =>
  console.log(`YEN Event Manager listening on port ${port}`),
);
