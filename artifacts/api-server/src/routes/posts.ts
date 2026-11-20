import { Router } from "express";
import { db, postsTable, categoriesTable, repliesTable } from "@workspace/db";
import { CreatePostBody, UpdatePostBody } from "@workspace/api-zod";
import { desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { rateLimit } from "../lib/rateLimit";
import { recordPostView } from "../lib/postViews";
import { markPostNotificationsRead, notifyMentions } from "../lib/notifications";
import {
  canModify,
  deletePostById,
  likePattern,
  parsePaging,
  selectPosts,
  serializePost,
} from "../lib/content";

const router = Router();
const createPostLimiter = rateLimit(5, 60 * 1000);
const searchLimiter = rateLimit(30, 60 * 1000);

async function listPosts(where: SQL | undefined, page: number, limit: number, offset: number) {
  const [rows, [total]] = await Promise.all([
    selectPosts()
      .where(where)
      .orderBy(desc(postsTable.isPinned), desc(postsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(postsTable).where(where),
  ]);
  return { posts: rows.map(serializePost), total: total?.count ?? 0, page, limit };
}

router.get("/posts", async (req, res) => {
  try {
    const { page, limit, offset } = parsePaging(req, { defaultLimit: 20, maxLimit: 50 });
    const categoryId = req.query.categoryId ? parseInt(String(req.query.categoryId), 10) : undefined;
    const where = categoryId && !isNaN(categoryId) ? eq(postsTable.categoryId, categoryId) : undefined;
    res.json(await listPosts(where, page, limit, offset));
  } catch (err) {
    req.log.error({ err }, "Failed to list posts");
    return res.status(500).json({ error: "Server error" });
  }
});

// Full-text-ish search over topic titles, topic bodies and reply bodies.
router.get("/search", searchLimiter, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2 || q.length > 100) {
    return res.status(400).json({ error: "Axtarış sözü 2-100 simvol olmalıdır" });
  }
  try {
    const { page, limit, offset } = parsePaging(req, { defaultLimit: 20, maxLimit: 50 });
    const pattern = likePattern(q);
    const where = or(
      ilike(postsTable.title, pattern),
      ilike(postsTable.content, pattern),
      sql`exists (select 1 from ${repliesTable} r where r.post_id = ${postsTable.id} and r.content ilike ${pattern})`,
    );
    res.json(await listPosts(where, page, limit, offset));
  } catch (err) {
    req.log.error({ err }, "Search failed");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/posts", createPostLimiter, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Mövzu açmaq üçün hesabınıza daxil olun" });
  }
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation error", details: parsed.error.issues });
  }
  if (!req.user.username) {
    return res.status(400).json({ error: "Əvvəlcə profilinizdə istifadəçi adı təyin edin" });
  }
  // Topics are signed by the account; any authorName in the body is ignored.
  const { categoryId, title, content } = parsed.data;
  try {
    const [cat] = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.id, categoryId));
    if (!cat) return res.status(400).json({ error: "Category not found" });

    const [post] = await db
      .insert(postsTable)
      .values({ categoryId, title, content, authorId: req.user.id, authorName: req.user.username, isPinned: false })
      .returning();

    await db
      .update(categoriesTable)
      .set({ postCount: sql`${categoriesTable.postCount} + 1` })
      .where(eq(categoriesTable.id, categoryId));

    await notifyMentions(`${title}\n${content}`, post.id, null, req.user.id).catch((err) =>
      req.log.error({ err }, "Failed to create mention notifications"),
    );

    const [row] = await selectPosts().where(eq(postsTable.id, post.id));
    res.status(201).json(serializePost(row));
  } catch (err) {
    req.log.error({ err }, "Failed to create post");
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/posts/recent", async (req, res) => {
  try {
    const rows = await selectPosts().orderBy(desc(postsTable.createdAt)).limit(10);
    res.json(rows.map(serializePost));
  } catch (err) {
    req.log.error({ err }, "Failed to list recent posts");
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/posts/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const [row] = await selectPosts().where(eq(postsTable.id, id));
    if (!row) return res.status(404).json({ error: "Not found" });

    // Once per viewer per day; refreshes and re-fetches don't inflate the count.
    const counted = await recordPostView(req, id);
    if (req.user) {
      await markPostNotificationsRead(req.user.id, id).catch((err) =>
        req.log.warn({ err }, "Failed to mark post notifications read"),
      );
    }

    res.json({ ...serializePost(row), viewCount: row.viewCount + (counted ? 1 : 0) });
  } catch (err) {
    req.log.error({ err }, "Failed to get post");
    return res.status(500).json({ error: "Server error" });
  }
});

// Author may edit title/content (marked as edited); only admins may pin.
router.patch("/posts/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const parsed = UpdatePostBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error", details: parsed.error.issues });

  try {
    const [existing] = await db
      .select({ authorId: postsTable.authorId })
      .from(postsTable)
      .where(eq(postsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!canModify(req.user, existing.authorId)) return res.status(403).json({ error: "Forbidden" });

    const { isPinned, title, content } = parsed.data;
    if (isPinned !== undefined && !req.user.isAdmin) {
      return res.status(403).json({ error: "Yalnız admin mövzunu sabitləyə bilər" });
    }

    const update: Partial<typeof postsTable.$inferInsert> = {};
    if (isPinned !== undefined) update.isPinned = isPinned;
    if (title !== undefined) update.title = title;
    if (content !== undefined) update.content = content;
    if (title !== undefined || content !== undefined) update.editedAt = new Date();
    if (Object.keys(update).length > 0) {
      await db.update(postsTable).set(update).where(eq(postsTable.id, id));
    }

    const [row] = await selectPosts().where(eq(postsTable.id, id));
    res.json(serializePost(row));
  } catch (err) {
    req.log.error({ err }, "Failed to update post");
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/posts/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const [existing] = await db
      .select({ authorId: postsTable.authorId })
      .from(postsTable)
      .where(eq(postsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!canModify(req.user, existing.authorId)) return res.status(403).json({ error: "Forbidden" });

    await deletePostById(id);
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete post");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
