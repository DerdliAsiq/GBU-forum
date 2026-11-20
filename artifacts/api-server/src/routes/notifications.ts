import { Router } from "express";
import { db, notificationsTable, postsTable, usersTable } from "@workspace/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

const router = Router();

// Not in the OpenAPI spec (like /profile): the forum calls these with apiFetch.

router.get("/notifications", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  try {
    const userId = req.user.id;
    const [items, [unread]] = await Promise.all([
      db
        .select({
          id: notificationsTable.id,
          type: notificationsTable.type,
          postId: notificationsTable.postId,
          postTitle: postsTable.title,
          replyId: notificationsTable.replyId,
          actorName: usersTable.username,
          readAt: notificationsTable.readAt,
          createdAt: notificationsTable.createdAt,
        })
        .from(notificationsTable)
        .leftJoin(postsTable, eq(notificationsTable.postId, postsTable.id))
        .leftJoin(usersTable, eq(notificationsTable.actorId, usersTable.id))
        .where(eq(notificationsTable.userId, userId))
        .orderBy(desc(notificationsTable.createdAt))
        .limit(30),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notificationsTable)
        .where(and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt))),
    ]);

    res.set("Cache-Control", "no-store");
    res.json({
      unreadCount: unread?.count ?? 0,
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        postId: n.postId,
        postTitle: n.postTitle,
        replyId: n.replyId,
        actorName: n.actorName,
        read: n.readAt != null,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list notifications");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/notifications/read-all", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  try {
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(and(eq(notificationsTable.userId, req.user.id), isNull(notificationsTable.readAt)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to mark notifications read");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/notifications/:id/read", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    // Scoped to the caller, so nobody can mark someone else's notification.
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.id, id),
          eq(notificationsTable.userId, req.user.id),
          isNull(notificationsTable.readAt),
        ),
      );
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to mark notification read");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
