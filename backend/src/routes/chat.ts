import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { asc, desc, eq, and, count } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db/index.js";
import { chatMessages, manualDeposits, users, chatThreadLocks } from "../db/schema.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { uploadPaymentScreenshot } from "../lib/storage.js";
import { publishChatEvent } from "../lib/realtime.js";

export const chatRouter = Router();

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

// Deposits linked from chat messages, joined live so top-up cards always
// show the current review status without any sync logic.
async function getUserChatDeposits(userId: string) {
  return db
    .select({
      id: manualDeposits.id,
      reference: manualDeposits.reference,
      amountGhs: manualDeposits.amountGhs,
      status: manualDeposits.status,
      rejectionReason: manualDeposits.rejectionReason,
    })
    .from(manualDeposits)
    .where(eq(manualDeposits.userId, userId))
    .orderBy(desc(manualDeposits.createdAt))
    .limit(50);
}

// Always returns the full thread (capped at 200 messages) rather than an
// incremental slice: messages can be hard-deleted with no tombstone left
// behind, so a partial "since last poll" fetch could never signal a removal
// to a client that already has the deleted message loaded.
chatRouter.get("/messages", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.userId;

  try {
    const senderAlias = alias(users, "chat_sender");
    const [messages, deposits, [lock]] = await Promise.all([
      db
        .select({
          id: chatMessages.id,
          userId: chatMessages.userId,
          senderId: chatMessages.senderId,
          senderRole: chatMessages.senderRole,
          body: chatMessages.body,
          imageUrl: chatMessages.imageUrl,
          manualDepositId: chatMessages.manualDepositId,
          readByUser: chatMessages.readByUser,
          readByAdmin: chatMessages.readByAdmin,
          createdAt: chatMessages.createdAt,
          editedAt: chatMessages.editedAt,
          editedByAdminName: chatMessages.editedByAdminName,
          senderName: senderAlias.fullName,
        })
        .from(chatMessages)
        .leftJoin(senderAlias, eq(chatMessages.senderId, senderAlias.id))
        .where(eq(chatMessages.userId, userId))
        .orderBy(asc(chatMessages.createdAt))
        .limit(200),
      getUserChatDeposits(userId),
      db
        .select()
        .from(chatThreadLocks)
        .where(eq(chatThreadLocks.threadUserId, userId))
        .limit(1),
    ]);

    res.json({ messages, deposits, lock: lock ?? null });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

const sendMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(2000).optional(),
    imageUrl: z.string().url().optional(),
  })
  .refine((data) => data.body || data.imageUrl, {
    message: "Message must have text or an image",
  });

chatRouter.post("/messages", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const [message] = await db
      .insert(chatMessages)
      .values({
        userId: req.user!.userId,
        senderId: req.user!.userId,
        senderRole: "user",
        body: parsed.data.body ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
        readByUser: true,
      })
      .returning();

    publishChatEvent(req.user!.userId, { type: "messages-changed" }).catch((err) =>
      console.error("Realtime publish failed:", err),
    );

    res.status(201).json({ message });
  } catch (error) {
    console.error("Error sending chat message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

chatRouter.post(
  "/upload",
  requireAuth,
  imageUpload.single("image"),
  async (req: AuthedRequest, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }
    try {
      const url = await uploadPaymentScreenshot(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
      );
      res.json({ url });
    } catch (error) {
      console.error("Error uploading chat image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  },
);

chatRouter.get("/unread", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const [row] = await db
      .select({ count: count() })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.userId, req.user!.userId),
          eq(chatMessages.readByUser, false),
        ),
      );
    res.json({ count: row?.count ?? 0 });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ error: "Failed to load unread count" });
  }
});

chatRouter.post("/read", requireAuth, async (req: AuthedRequest, res) => {
  try {
    await db
      .update(chatMessages)
      .set({ readByUser: true })
      .where(
        and(
          eq(chatMessages.userId, req.user!.userId),
          eq(chatMessages.readByUser, false),
        ),
      );
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking chat read:", error);
    res.status(500).json({ error: "Failed to mark as read" });
  }
});
