import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { app } from "./app.js";
import { runDailyRoiAccrual } from "./lib/roiAccrual.js";

// This entry is for the always-on single-service deployment (local dev and
// Render): the same Express app also serves the built frontend, listens on a
// port, and runs the ROI cron in-process. On Vercel the app is imported by
// api/index.mjs as a serverless function instead, the frontend is served as
// static files, and the cron is triggered externally via /api/cron/daily-roi.
const port = process.env.PORT ?? 3001;

// When deployed as a single service, the frontend is built to frontend/dist
// and served directly by this server. In local dev, frontend/dist won't exist
// (the frontend runs on its own Vite dev server instead), so this is skipped.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");

if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`InfoPay API listening on http://localhost:${port}`);
});

// Idempotent per calendar day (see lib/roiAccrual.ts), so an hourly check
// is safe — it only actually credits once per investment per day.
runDailyRoiAccrual().catch((err) => console.error("ROI accrual failed:", err));
setInterval(
  () => runDailyRoiAccrual().catch((err) => console.error("ROI accrual failed:", err)),
  60 * 60 * 1000,
);
