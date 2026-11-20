import { Router } from "express";
import { db, usersTable, postsTable, repliesTable, categoriesTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";

const router = Router();

// Public profile: who someone is and what they wrote. No private fields (email, ban reason, ...).
router.get("/users/:username", async (req, res) => {
  const username = String(req.params.username).slice(0, 50);
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
    if (!user) return res.status(404).json({ error: "İstifadəçi tapılmadı" });

    const [[postCount], [replyCount], posts, replies] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(postsTable).where(eq(postsTable.authorId, user.id)),
      db.select({ count: sql<number>`count(*)::int` }).from(repliesTable).where(eq(repliesTable.authorId, user.id)),
      db
        .select({
          id: postsTable.id,
          title: postsTable.title,
          categoryName: categoriesTable.name,
          replyCount: postsTable.replyCount,
          createdAt: postsTable.createdAt,
        })
        .from(postsTable)
        .innerJoin(categoriesTable, eq(postsTable.categoryId, categoriesTable.id))
        .where(eq(postsTable.authorId, user.id))
        .orderBy(desc(postsTable.createdAt))
        .limit(20),
      db
        .select({
          id: repliesTable.id,
          postId: repliesTable.postId,
          postTitle: postsTable.title,
          excerpt: sql<string>`left(${repliesTable.content}, 200)`,
          createdAt: repliesTable.createdAt,
        })
        .from(repliesTable)
        .innerJoin(postsTable, eq(repliesTable.postId, postsTable.id))
        .where(eq(repliesTable.authorId, user.id))
        .orderBy(desc(repliesTable.createdAt))
        .limit(20),
    ]);

    res.json({
      username: user.username,
      displayName: user.displayName,
      profileImageUrl: user.profileImageUrl,
      isAdmin: user.isAdmin,
      isBanned: user.isBanned,
      createdAt: user.createdAt.toISOString(),
      postCount: postCount?.count ?? 0,
      replyCount: replyCount?.count ?? 0,
      posts: posts.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
      replies: replies.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load profile");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
