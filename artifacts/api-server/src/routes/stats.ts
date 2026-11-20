import { Router } from "express";
import { db, postsTable, repliesTable, categoriesTable } from "@workspace/db";
import { sql, gte } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [postStats, replyStats, catStats, activeStats] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(postsTable),
      db.select({ count: sql<number>`count(*)::int` }).from(repliesTable),
      db.select({ count: sql<number>`count(*)::int` }).from(categoriesTable),
      // "Active today" = distinct people who opened a topic or replied today.
      db.execute<{ count: number }>(sql`
        select count(distinct author_id)::int as count from (
          select author_id from posts where created_at >= ${today} and author_id is not null
          union all
          select author_id from replies where created_at >= ${today} and author_id is not null
        ) as activity`),
    ]);

    res.json({
      totalPosts: postStats[0]?.count ?? 0,
      totalReplies: replyStats[0]?.count ?? 0,
      totalCategories: catStats[0]?.count ?? 0,
      activeToday: activeStats.rows[0]?.count ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
