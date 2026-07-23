import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { announcements } from "../db/schema.js";

export const announcementsRouter = Router();

// Public: active announcements in display order, shown to users on site access.
announcementsRouter.get("/", async (_req, res) => {
  try {
    const list = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
      })
      .from(announcements)
      .where(eq(announcements.isActive, true))
      .orderBy(asc(announcements.sortOrder), asc(announcements.createdAt));
    res.json({ announcements: list });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});
