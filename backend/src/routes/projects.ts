import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { projects } from "../db/schema.js";

export const projectsRouter = Router();

// Each package has one fixed investment amount — no crowdfunding target,
// no raised total, no min/max range. minInvestmentGhs holds that fixed amount.
const PUBLIC_PROJECT_COLUMNS = {
  id: projects.id,
  title: projects.title,
  description: projects.description,
  amountGhs: projects.minInvestmentGhs,
  expectedReturnPct: projects.expectedReturnPct,
  durationDays: projects.durationDays,
  imageUrl: projects.imageUrl,
  createdAt: projects.createdAt,
};

projectsRouter.get("/", async (_req, res) => {
  const list = await db
    .select(PUBLIC_PROJECT_COLUMNS)
    .from(projects)
    .where(eq(projects.isActive, true))
    .orderBy(asc(projects.minInvestmentGhs));
  res.json({ projects: list });
});

projectsRouter.get("/:id", async (req, res) => {
  const [project] = await db
    .select(PUBLIC_PROJECT_COLUMNS)
    .from(projects)
    .where(eq(projects.id, req.params.id))
    .limit(1);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  res.json({ project });
});
