import { Router } from "express";
import { db } from "../db/index.js";
import { supportSettings } from "../db/schema.js";

export const supportRouter = Router();

// Public: returns only the support links that are actually configured, so the
// client can decide whether to show the support entry point at all.
supportRouter.get("/", async (_req, res) => {
  try {
    const [row] = await db.select().from(supportSettings).limit(1);

    const whatsappChannelUrl = row?.whatsappChannelUrl?.trim() || undefined;
    const telegramGroupUrl = row?.telegramGroupUrl?.trim() || undefined;
    const telegramProfiles = (row?.telegramProfiles ?? [])
      .filter((p) => p && p.url && p.url.trim())
      .map((p) => ({ label: p.label?.trim() || "Telegram", url: p.url.trim() }));

    res.json({ whatsappChannelUrl, telegramGroupUrl, telegramProfiles });
  } catch (error) {
    console.error("Error fetching support settings:", error);
    res.status(500).json({ error: "Failed to fetch support settings" });
  }
});
