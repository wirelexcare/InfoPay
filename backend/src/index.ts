import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { authRouter } from "./routes/auth.js";
import { kycRouter } from "./routes/kyc.js";
import { projectsRouter } from "./routes/projects.js";
import { investmentsRouter } from "./routes/investments.js";
import { paymentsRouter } from "./routes/payments.js";
import { usersRouter } from "./routes/users.js";
import { walletRouter } from "./routes/wallet.js";
import { adminRouter } from "./routes/admin.js";
import { referralsRouter } from "./routes/referrals.js";
import { runDailyRoiAccrual } from "./lib/roiAccrual.js";

// An unhandled rejection anywhere in the app (e.g. a payment provider's API
// timing out) crashes the whole Node process by default since Node 15 —
// taking down every route for every user, not just the one that failed.
// Log it instead so a single flaky external call can't kill the server.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

const app = express();
const port = process.env.PORT ?? 3001;

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/kyc", kycRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/investments", investmentsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/users", usersRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/admin", adminRouter);
app.use("/api/referrals", referralsRouter);

// When deployed as a single service, the frontend is built to
// frontend/dist and served directly by this server — so Render (or any
// host) only needs one Web Service instead of separate front/backend
// deployments. In local dev, frontend/dist won't exist (the frontend
// runs on its own Vite dev server instead), so this is skipped.
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
