import { Router } from "express";
import { db, repliesTable, postsTable, usersTable } from "@workspace/db";
import { CreateReplyBody } from "@workspace/api-zod";
import { eq, asc, sql } from "drizzle-orm";
import { rateLimit } from "../lib/rateLimit";

const router = Router();
const createReplyLimiter = rateLimit(10, 60 * 1000);

router.get("/posts/:id/replies", async (req, res) => {
  const postId = parseInt(req.params.id, 10);
  if (isNaN(postId)) return res.status(400).json({ error: "Invalid id" });
  try {
    const rows = await db
      .select({
        id: repliesTable.id,
        postId: repliesTable.postId,
        content: repliesTable.content,
        // Always the author's *current* username; the stored snapshot is only
        // a fallback for replies whose account no longer exists.
        authorName: sql<string>`coalesce(${usersTable.username}, ${repliesTable.authorName})`,
        createdAt: repliesTable.createdAt,
      })
      .from(repliesTable)
      .leftJoin(usersTable, eq(repliesTable.authorId, usersTable.id))
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

    const [reply] = await db.insert(repliesTable).values({
      postId,
      content,
      authorId: req.user.id,
      authorName: req.user.username,
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
