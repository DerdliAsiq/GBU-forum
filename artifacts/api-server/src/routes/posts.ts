import { Router } from "express";
import { db, postsTable, categoriesTable, usersTable } from "@workspace/db";
import { CreatePostBody } from "@workspace/api-zod";
import { eq, desc, sql } from "drizzle-orm";
import { rateLimit } from "../lib/rateLimit";

const router = Router();

// Always show the author's *current* username (falls back to the stored
// snapshot only when the account no longer exists).
const authorNameSql = sql<string>`coalesce(${usersTable.username}, ${postsTable.authorName})`;
const createPostLimiter = rateLimit(5, 60 * 1000);

router.get("/posts", async (req, res) => {
  try {
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string, 10) : undefined;
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);
    const offset = (page - 1) * limit;

    let baseQuery = db
      .select({
        id: postsTable.id,
        categoryId: postsTable.categoryId,
        categoryName: categoriesTable.name,
        title: postsTable.title,
        content: postsTable.content,
        authorName: authorNameSql,
        createdAt: postsTable.createdAt,
        replyCount: postsTable.replyCount,
        viewCount: postsTable.viewCount,
        isPinned: postsTable.isPinned,
        lastReplyAt: postsTable.lastReplyAt,
      })
      .from(postsTable)
      .innerJoin(categoriesTable, eq(postsTable.categoryId, categoriesTable.id))
      .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id));

    const countQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(postsTable);

    let posts: typeof baseQuery;
    let totalResult: typeof countQuery;

    if (categoryId) {
      posts = baseQuery
        .where(eq(postsTable.categoryId, categoryId))
        .orderBy(desc(postsTable.isPinned), desc(postsTable.createdAt))
        .limit(limit)
        .offset(offset) as typeof baseQuery;
      totalResult = countQuery.where(eq(postsTable.categoryId, categoryId)) as typeof countQuery;
    } else {
      posts = baseQuery
        .orderBy(desc(postsTable.isPinned), desc(postsTable.createdAt))
        .limit(limit)
        .offset(offset) as typeof baseQuery;
      totalResult = countQuery as typeof countQuery;
    }

    const [rows, totals] = await Promise.all([posts, totalResult]);
    const total = totals[0]?.count ?? 0;

    res.json({
      posts: rows.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        lastReplyAt: p.lastReplyAt ? p.lastReplyAt.toISOString() : null,
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list posts");
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
  // Topics are signed by the account; any authorName in the body is ignored.
  const { categoryId, title, content } = parsed.data;
  if (!req.user.username) {
    return res.status(400).json({ error: "Əvvəlcə profilinizdə istifadəçi adı təyin edin" });
  }
  const authorName = req.user.username;
  try {
    const [cat] = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.id, categoryId));
    if (!cat) return res.status(400).json({ error: "Category not found" });

    const [post] = await db.insert(postsTable).values({
      categoryId,
      title,
      content,
      authorId: req.user.id,
      authorName,
      isPinned: false,
    }).returning();

    await db.update(categoriesTable)
      .set({ postCount: sql`${categoriesTable.postCount} + 1` })
      .where(eq(categoriesTable.id, categoryId));

    const [row] = await db
      .select({
        id: postsTable.id,
        categoryId: postsTable.categoryId,
        categoryName: categoriesTable.name,
        title: postsTable.title,
        content: postsTable.content,
        authorName: authorNameSql,
        createdAt: postsTable.createdAt,
        replyCount: postsTable.replyCount,
        viewCount: postsTable.viewCount,
        isPinned: postsTable.isPinned,
        lastReplyAt: postsTable.lastReplyAt,
      })
      .from(postsTable)
      .innerJoin(categoriesTable, eq(postsTable.categoryId, categoriesTable.id))
      .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .where(eq(postsTable.id, post.id));

    res.status(201).json({
      ...row,
      createdAt: row.createdAt.toISOString(),
      lastReplyAt: row.lastReplyAt ? row.lastReplyAt.toISOString() : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create post");
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/posts/recent", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: postsTable.id,
        categoryId: postsTable.categoryId,
        categoryName: categoriesTable.name,
        title: postsTable.title,
        content: postsTable.content,
        authorName: authorNameSql,
        createdAt: postsTable.createdAt,
        replyCount: postsTable.replyCount,
        viewCount: postsTable.viewCount,
        isPinned: postsTable.isPinned,
        lastReplyAt: postsTable.lastReplyAt,
      })
      .from(postsTable)
      .innerJoin(categoriesTable, eq(postsTable.categoryId, categoriesTable.id))
      .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .orderBy(desc(postsTable.createdAt))
      .limit(10);

    res.json(rows.map(p => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      lastReplyAt: p.lastReplyAt ? p.lastReplyAt.toISOString() : null,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list recent posts");
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/posts/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const [row] = await db
      .select({
        id: postsTable.id,
        categoryId: postsTable.categoryId,
        categoryName: categoriesTable.name,
        title: postsTable.title,
        content: postsTable.content,
        authorName: authorNameSql,
        createdAt: postsTable.createdAt,
        replyCount: postsTable.replyCount,
        viewCount: postsTable.viewCount,
        isPinned: postsTable.isPinned,
        lastReplyAt: postsTable.lastReplyAt,
      })
      .from(postsTable)
      .innerJoin(categoriesTable, eq(postsTable.categoryId, categoriesTable.id))
      .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .where(eq(postsTable.id, id));

    if (!row) return res.status(404).json({ error: "Not found" });

    await db.update(postsTable)
      .set({ viewCount: sql`${postsTable.viewCount} + 1` })
      .where(eq(postsTable.id, id));

    res.json({
      ...row,
      createdAt: row.createdAt.toISOString(),
      lastReplyAt: row.lastReplyAt ? row.lastReplyAt.toISOString() : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get post");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
