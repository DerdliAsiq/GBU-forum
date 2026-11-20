import { Router } from "express";
import { db, repliesTable, postsTable } from "@workspace/db";
import { CreateReplyBody } from "@workspace/api-zod";
import { eq, asc, sql } from "drizzle-orm";
import { rateLimit } from "../lib/rateLimit";
import { isReservedAuthorName, RESERVED_AUTHOR_ERROR } from "../lib/authorName";

const router = Router();
const createReplyLimiter = rateLimit(10, 60 * 1000);

router.get("/posts/:id/replies", async (req, res) => {
  const postId = parseInt(req.params.id, 10);
  if (isNaN(postId)) return res.status(400).json({ error: "Invalid id" });
  try {
    const rows = await db
      .select()
      .from(repliesTable)
      .where(eq(repliesTable.postId, postId))
      .orderBy(asc(repliesTable.createdAt));

    res.json(rows.map(r => ({
      id: r.id,
      postId: r.postId,
      content: r.content,
      authorName: r.authorName,
      createdAt: r.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list replies");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/posts/:id/replies", createReplyLimiter, async (req, res) => {
  const postId = parseInt(String(req.params.id), 10);
  if (isNaN(postId)) return res.status(400).json({ error: "Invalid id" });

  const parsed = CreateReplyBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation error", details: parsed.error.issues });
  }

  const { content, authorName } = parsed.data;
  if (authorName && !req.user?.isAdmin && isReservedAuthorName(authorName)) {
    return res.status(400).json({ error: RESERVED_AUTHOR_ERROR });
  }
  try {
    const [post] = await db.select({ id: postsTable.id }).from(postsTable).where(eq(postsTable.id, postId));
    if (!post) return res.status(404).json({ error: "Post not found" });

    const [reply] = await db.insert(repliesTable).values({
      postId,
      content,
      authorName: authorName || "Anonim",
    }).returning();

    await db.update(postsTable)
      .set({
        replyCount: sql`${postsTable.replyCount} + 1`,
        lastReplyAt: new Date(),
      })
      .where(eq(postsTable.id, postId));

    res.status(201).json({
      id: reply.id,
      postId: reply.postId,
      content: reply.content,
      authorName: reply.authorName,
      createdAt: reply.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create reply");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
