import express from "express";
import { config } from "./config.js";
import { createStore } from "./store/index.js";
import { createDataService } from "./data/index.js";
import { buildPlan } from "./plan/index.js";
import { registerRoutes } from "./routes/index.js";

const app = express();
const startedAt = new Date().toISOString();

const store = createStore({ dataDir: config.dataDir, exampleDir: config.exampleDir });
const data = createDataService({ store, config, buildPlan });

app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    name: "KAIROS",
    version: "0.1.0",
    port: config.port,
    debug: config.debug,
    plannerName: config.name,
    startedAt,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

registerRoutes(app, { data, config });

app.use(express.static(config.publicDir, { index: "index.html" }));

app.use((req, res) => {
  res.status(404).json({ ok: false, error: "not_found", path: req.path });
});

// Last: a failing route should not print a stack to the client.
app.use((error, req, res, _next) => {
  console.error(error);
  res.status(500).json({ ok: false, error: "server_error", message: error.message });
});

const http = await store
  .seed()
  .then(() => app.listen(config.port))
  .catch((error) => {
    console.error("KAIROS failed to start", error);
    process.exit(1);
  });

if (http) console.log(`KAIROS listening on http://localhost:${config.port}`);

// The Edge app window closing does not stop this process; kairos.bat documents
// Ctrl+C here, and the window title makes the server easy to find.
const stop = () => http?.close(() => process.exit(0));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

