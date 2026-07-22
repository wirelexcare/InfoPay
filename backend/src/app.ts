import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { kycRouter } from "./routes/kyc.js";
import { projectsRouter } from "./routes/projects.js";
import { investmentsRouter } from "./routes/investments.js";
import { paymentsRouter } from "./routes/payments.js";
import { usersRouter } from "./routes/users.js";
import { walletRouter } from "./routes/wallet.js";
import { adminRouter } from "./routes/admin.js";
import { referralsRouter } from "./routes/referrals.js";
import { cronRouter } from "./routes/cron.js";

// An unhandled rejection anywhere in the app (e.g. a payment provider's API
// timing out) crashes the whole Node process by default since Node 15 —
// taking down every route for every user, not just the one that failed.
// Log it instead so a single flaky external call can't kill the server.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

export const app = express();

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
app.use("/api/cron", cronRouter);

export default app;
