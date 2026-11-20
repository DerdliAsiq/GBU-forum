import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Router, type NextFunction, type Request, type Response } from "express";
import {
  db,
  usersTable,
  postsTable,
  repliesTable,
  categoriesTable,
  reportsTable,
  sessionsTable,
} from "@workspace/db";
import { CreateCategoryBody, UpdateCategoryBody } from "@workspace/api-zod";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { deletePostById, deleteReplyById, iso, likePattern, parsePaging } from "../lib/content";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

function serializeUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.displayName,
    firstName: u.firstName,
    lastName: u.lastName,
    profileImageUrl: u.profileImageUrl,
    isAdmin: u.isAdmin,
    isBanned: u.isBanned,
    createdAt: u.createdAt.toISOString(),
  };
}

/** Ends every session of a user (sessions store the user id inside the JSON payload). */
async function endUserSessions(userId: string) {
  await db.delete(sessionsTable).where(sql`${sessionsTable.sess}->'user'->>'id' = ${userId}`);
}

// ---------------------------------------------------------------- users

router.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    res.json(users.map(serializeUser));
  } catch (err) {
    req.log.error({ err }, "Failed to list users");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/users/:id/toggle-admin", requireAdmin, async (req, res) => {
  const userId = String(req.params.id);
  if (userId === req.user!.id) {
    return res.status(400).json({ error: "Öz admin səlahiyyətinizi ala bilməzsiniz" });
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    const [updated] = await db
      .update(usersTable)
      .set({ isAdmin: !user.isAdmin, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();
    res.json(serializeUser(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to toggle admin");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/users/:id/toggle-ban", requireAdmin, async (req, res) => {
  const userId = String(req.params.id);
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.isAdmin) return res.status(400).json({ error: "Admin hesabı bloklamaq olmaz" });

    const [updated] = await db
      .update(usersTable)
      .set({ isBanned: !user.isBanned, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();
    if (updated.isBanned) await endUserSessions(userId);
    res.json(serializeUser(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to toggle ban");
    return res.status(500).json({ error: "Server error" });
  }
});

// Sets a random temporary password (shown once to the admin) and signs the user out everywhere.
router.post("/admin/users/:id/reset-password", requireAdmin, async (req, res) => {
  const userId = String(req.params.id);
  if (userId === req.user!.id) {
    return res.status(400).json({ error: "Öz şifrənizi Ayarlar səhifəsindən dəyişin" });
  }
  try {
    const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    const temporaryPassword = crypto.randomBytes(9).toString("base64url");
    await db
      .update(usersTable)
      .set({ passwordHash: await bcrypt.hash(temporaryPassword, 12), updatedAt: new Date() })
      .where(eq(usersTable.id, userId));
    await endUserSessions(userId);
    res.set("Cache-Control", "no-store");
    res.json({ temporaryPassword });
  } catch (err) {
    req.log.error({ err }, "Failed to reset password");
    return res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------------------------------------------- categories

function serializeCategory(c: typeof categoriesTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    slug: c.slug,
    icon: c.icon ?? null,
    postCount: c.postCount,
  };
}

router.post("/categories", requireAdmin, async (req, res) => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error" });
  try {
    const [cat] = await db
      .insert(categoriesTable)
      .values({
        name: parsed.data.name,
        description: parsed.data.description,
        slug: parsed.data.slug,
        icon: parsed.data.icon || null,
      })
      .returning();
    res.status(201).json(serializeCategory(cat));
  } catch (err) {
    req.log.error({ err }, "Failed to create category");
    return res.status(500).json({ error: "Server error" });
  }
});

router.put("/categories/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error" });
  try {
    const [cat] = await db
      .update(categoriesTable)
      .set({
        name: parsed.data.name,
        description: parsed.data.description,
        slug: parsed.data.slug,
        icon: parsed.data.icon || null,
      })
      .where(eq(categoriesTable.id, id))
      .returning();
    if (!cat) return res.status(404).json({ error: "Not found" });
    res.json(serializeCategory(cat));
  } catch (err) {
    req.log.error({ err }, "Failed to update category");
    return res.status(500).json({ error: "Server error" });
  }
});

// A category that still has topics can only be deleted with ?moveTo=<categoryId>,
// which moves its topics there first.
router.delete("/categories/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const moveTo = req.query.moveTo ? parseInt(String(req.query.moveTo), 10) : null;

  try {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id));
    if (!cat) return res.status(404).json({ error: "Not found" });

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(postsTable)
      .where(eq(postsTable.categoryId, id));

    if (count > 0) {
      if (moveTo == null || isNaN(moveTo) || moveTo === id) {
        return res.status(409).json({
          error: `Bu kateqoriyada ${count} mövzu var. Silməzdən əvvəl onları başqa kateqoriyaya köçürün.`,
          postCount: count,
        });
      }
      const [target] = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.id, moveTo));
      if (!target) return res.status(400).json({ error: "Hədəf kateqoriya tapılmadı" });

      await db.update(postsTable).set({ categoryId: moveTo }).where(eq(postsTable.categoryId, id));
      await db
        .update(categoriesTable)
        .set({ postCount: sql`${categoriesTable.postCount} + ${count}` })
        .where(eq(categoriesTable.id, moveTo));
    }

    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete category");
    return res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------------------------------------------- replies

router.get("/admin/replies", requireAdmin, async (req, res) => {
  try {
    const { page, limit, offset } = parsePaging(req, { defaultLimit: 50, maxLimit: 100 });
    const q = String(req.query.q ?? "").trim().slice(0, 100);
    const where = q
      ? or(ilike(repliesTable.content, likePattern(q)), ilike(usersTable.username, likePattern(q)), ilike(postsTable.title, likePattern(q)))
      : undefined;

    const base = () =>
      db
        .select({
          id: repliesTable.id,
          postId: repliesTable.postId,
          postTitle: postsTable.title,
          content: repliesTable.content,
          authorName: sql<string>`coalesce(${usersTable.username}, ${repliesTable.authorName})`,
          createdAt: repliesTable.createdAt,
          editedAt: repliesTable.editedAt,
        })
        .from(repliesTable)
        .innerJoin(postsTable, eq(repliesTable.postId, postsTable.id))
        .leftJoin(usersTable, eq(repliesTable.authorId, usersTable.id))
        .where(where)
        .$dynamic();

    const [rows, [total]] = await Promise.all([
      base().orderBy(desc(repliesTable.createdAt)).limit(limit).offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(repliesTable)
        .innerJoin(postsTable, eq(repliesTable.postId, postsTable.id))
        .leftJoin(usersTable, eq(repliesTable.authorId, usersTable.id))
        .where(where),
    ]);

    res.json({
      replies: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), editedAt: iso(r.editedAt) })),
      total: total?.count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list replies");
    return res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------------------------------------------- reports

router.get("/admin/reports", requireAdmin, async (req, res) => {
  const status = ["open", "resolved", "dismissed"].includes(String(req.query.status))
    ? String(req.query.status)
    : "open";
  try {
    const rows = await db
      .select({
        id: reportsTable.id,
        reason: reportsTable.reason,
        details: reportsTable.details,
        status: reportsTable.status,
        createdAt: reportsTable.createdAt,
        resolvedAt: reportsTable.resolvedAt,
        reporterName: sql<string | null>`(select username from users where id = ${reportsTable.reporterId})`,
        postId: sql<number | null>`coalesce(${reportsTable.postId}, (select post_id from replies where id = ${reportsTable.replyId}))`,
        replyId: reportsTable.replyId,
        postTitle: sql<string | null>`(select title from posts where id = coalesce(${reportsTable.postId}, (select post_id from replies where id = ${reportsTable.replyId})))`,
        excerpt: sql<string | null>`left(coalesce((select content from replies where id = ${reportsTable.replyId}), (select content from posts where id = ${reportsTable.postId})), 300)`,
        authorName: sql<string | null>`(select username from users where id = coalesce((select author_id from replies where id = ${reportsTable.replyId}), (select author_id from posts where id = ${reportsTable.postId})))`,
      })
      .from(reportsTable)
      .where(eq(reportsTable.status, status))
      .orderBy(desc(reportsTable.createdAt))
      .limit(100);

    const [open] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reportsTable)
      .where(eq(reportsTable.status, "open"));

    res.set("Cache-Control", "no-store");
    res.json({
      openCount: open?.count ?? 0,
      reports: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), resolvedAt: iso(r.resolvedAt) })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list reports");
    return res.status(500).json({ error: "Server error" });
  }
});

// action "remove" deletes the reported content; "dismiss" keeps it. Either way
// every open report on the same content is closed.
router.post("/admin/reports/:id/resolve", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const action = req.body?.action;
  if (isNaN(id) || (action !== "remove" && action !== "dismiss")) {
    return res.status(400).json({ error: "Invalid request" });
  }
  try {
    const [report] = await db.select().from(reportsTable).where(eq(reportsTable.id, id));
    if (!report) return res.status(404).json({ error: "Not found" });

    const sameTarget = report.replyId
      ? eq(reportsTable.replyId, report.replyId)
      : eq(reportsTable.postId, report.postId!);

    // Close the reports before deleting: deleting the content cascades the report rows away.
    await db
      .update(reportsTable)
      .set({
        status: action === "remove" ? "resolved" : "dismissed",
        resolvedBy: req.user!.id,
        resolvedAt: new Date(),
      })
      .where(and(sameTarget, eq(reportsTable.status, "open")));

    if (action === "remove") {
      if (report.replyId) await deleteReplyById(report.replyId);
      else if (report.postId) await deletePostById(report.postId);
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to resolve report");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
