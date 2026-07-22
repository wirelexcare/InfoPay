import { Router } from "express";
import { runDailyRoiAccrual } from "../lib/roiAccrual.js";

export const cronRouter = Router();

// Triggered by an external scheduler (Vercel Cron, cron-job.org, etc.) since
// serverless has no always-on process to run setInterval. Secured by
// CRON_SECRET, accepted three ways so it works with whatever the scheduler
// can send:
//   - Authorization: Bearer <secret>   (Vercel Cron sets this automatically)
//   - x-cron-secret: <secret>
//   - ?secret=<secret>
function isAuthorized(req: {
  headers: Record<string, unknown>;
  query: Record<string, unknown>;
}): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const authHeader = String(req.headers["authorization"] ?? "");
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  const headerSecret = req.headers["x-cron-secret"];
  const querySecret = req.query.secret;

  return (
    bearer === expected ||
    headerSecret === expected ||
    querySecret === expected
  );
}

async function handle(req: any, res: any) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const result = await runDailyRoiAccrual();
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("Cron ROI accrual failed:", error);
    res.status(500).json({ error: "ROI accrual failed" });
  }
}

// GET for Vercel Cron / simple pingers; POST for schedulers that prefer it.
cronRouter.get("/daily-roi", handle);
cronRouter.post("/daily-roi", handle);
