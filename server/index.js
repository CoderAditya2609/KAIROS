import express from "express";
import { config } from "./config.js";

const app = express();
const startedAt = new Date().toISOString();

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

app.use(express.static(config.publicDir, { index: "index.html" }));

app.use((req, res) => {
  res.status(404).json({ ok: false, error: "not_found", path: req.path });
});

const server = app.listen(config.port, () => {
  console.log(`KAIROS listening on http://localhost:${config.port}`);
});

// The Edge app window closing does not stop this process; kairos.bat documents
// Ctrl+C here, and the window title makes the server easy to find.
process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
