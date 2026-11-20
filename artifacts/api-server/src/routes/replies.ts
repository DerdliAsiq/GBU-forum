import { Router } from "express";
import { db, repliesTable, postsTable } from "@workspace/db";
import { CreateReplyBody, UpdateReplyBody } from "@workspace/api-zod";
import { eq, asc, sql } from "drizzle-orm";
import { rateLimit } from "../lib/rateLimit";
import { notifyMentions, notifyReply } from "../lib/notifications";
import { canModify, deleteReplyById, selectReplies, serializeReply } from "../lib/content";

const router = Router();
const createReplyLimiter = rateLimit(10, 60 * 1000);

router.get("/posts/:id/replies", async (req, res) => {
  const postId = parseInt(req.params.id, 10);
  if (isNaN(postId)) return res.status(400).json({ error: "Invalid id" });
  try {
    const rows = await selectReplies()
      .where(eq(repliesTable.postId, postId))
      .orderBy(asc(repliesTable.createdAt));
    res.json(rows.map(serializeReply));
  } catch (err) {
    req.log.error({ err }, "Failed to list replies");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/posts/:id/replies", createReplyLimiter, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Cavab yazmaq üçün hesabınıza daxil olun" });
  }
  const postId = parseInt(String(req.params.id), 10);
  if (isNaN(postId)) return res.status(400).json({ error: "Invalid id" });

  const parsed = CreateReplyBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation error", details: parsed.error.issues });
  }
  if (!req.user.username) {
    return res.status(400).json({ error: "Əvvəlcə profilinizdə istifadəçi adı təyin edin" });
  }

  // Replies are signed by the account; any authorName in the body is ignored.
  const { content } = parsed.data;
  try {
    const [post] = await db.select({ id: postsTable.id }).from(postsTable).where(eq(postsTable.id, postId));
    if (!post) return res.status(404).json({ error: "Post not found" });

    const [reply] = await db
      .insert(repliesTable)
      .values({ postId, content, authorId: req.user.id, authorName: req.user.username })
      .returning();

    await db
      .update(postsTable)
      .set({ replyCount: sql`${postsTable.replyCount} + 1`, lastReplyAt: new Date() })
      .where(eq(postsTable.id, postId));

    // Notification failures must never fail the reply itself.
    try {
      const notified = await notifyReply(postId, reply.id, req.user.id);
      await notifyMentions(content, postId, reply.id, req.user.id, notified);
    } catch (err) {
      req.log.error({ err }, "Failed to create reply notifications");
    }

    const [row] = await selectReplies().where(eq(repliesTable.id, reply.id));
    res.status(201).json(serializeReply(row));
  } catch (err) {
    req.log.error({ err }, "Failed to create reply");
    return res.status(500).json({ error: "Server error" });
  }
});

// Its author or an admin may edit (marked as edited) or delete a reply.
router.patch("/replies/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const parsed = UpdateReplyBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error", details: parsed.error.issues });

  try {
    const [existing] = await db
      .select({ authorId: repliesTable.authorId })
      .from(repliesTable)
      .where(eq(repliesTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!canModify(req.user, existing.authorId)) return res.status(403).json({ error: "Forbidden" });

    await db
      .update(repliesTable)
      .set({ content: parsed.data.content, editedAt: new Date() })
      .where(eq(repliesTable.id, id));
    const [row] = await selectReplies().where(eq(repliesTable.id, id));
    res.json(serializeReply(row));
  } catch (err) {
    req.log.error({ err }, "Failed to update reply");
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/replies/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const [existing] = await db
      .select({ authorId: repliesTable.authorId })
      .from(repliesTable)
      .where(eq(repliesTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!canModify(req.user, existing.authorId)) return res.status(403).json({ error: "Forbidden" });

    await deleteReplyById(id);
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete reply");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
