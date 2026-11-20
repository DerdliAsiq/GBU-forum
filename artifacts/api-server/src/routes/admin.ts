import { Router } from "express";
import { db, usersTable, postsTable, repliesTable, categoriesTable } from "@workspace/db";
import { CreateCategoryBody, UpdateCategoryBody, UpdatePostBody } from "@workspace/api-zod";
import { eq, sql } from "drizzle-orm";

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

router.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    res.json(users.map(u => ({
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
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list users");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/users/:id/toggle-admin", requireAdmin, async (req, res) => {
  const userId = req.params.id;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    const [updated] = await db
      .update(usersTable)
      .set({ isAdmin: !user.isAdmin, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();

    res.json({
      id: updated.id,
      email: updated.email,
      username: updated.username,
      displayName: updated.displayName,
      firstName: updated.firstName,
      lastName: updated.lastName,
      profileImageUrl: updated.profileImageUrl,
      isAdmin: updated.isAdmin,
      isBanned: updated.isBanned,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to toggle admin");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/users/:id/toggle-ban", requireAdmin, async (req, res) => {
  const userId = req.params.id;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.isAdmin) {
      return res.status(400).json({ error: "Admin hesabı bloklamaq olmaz" });
    }

    const [updated] = await db
      .update(usersTable)
      .set({ isBanned: !user.isBanned, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();

    res.json({
      id: updated.id,
      email: updated.email,
      username: updated.username,
      displayName: updated.displayName,
      firstName: updated.firstName,
      lastName: updated.lastName,
      profileImageUrl: updated.profileImageUrl,
      isAdmin: updated.isAdmin,
      isBanned: updated.isBanned,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to toggle ban");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/categories", requireAdmin, async (req, res) => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error" });

  try {
    const [cat] = await db.insert(categoriesTable).values({
      name: parsed.data.name,
      description: parsed.data.description,
      slug: parsed.data.slug,
      icon: parsed.data.icon ?? null,
    }).returning();
    res.status(201).json({ id: cat.id, name: cat.name, description: cat.description, slug: cat.slug, icon: cat.icon ?? null, postCount: cat.postCount });
  } catch (err) {
    req.log.error({ err }, "Failed to create category");
    return res.status(500).json({ error: "Server error" });
  }
});

router.put("/categories/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error" });

  try {
    const [cat] = await db.update(categoriesTable).set({
      name: parsed.data.name,
      description: parsed.data.description,
      slug: parsed.data.slug,
      icon: parsed.data.icon ?? null,
    }).where(eq(categoriesTable.id, id)).returning();
    if (!cat) return res.status(404).json({ error: "Not found" });
    res.json({ id: cat.id, name: cat.name, description: cat.description, slug: cat.slug, icon: cat.icon ?? null, postCount: cat.postCount });
  } catch (err) {
    req.log.error({ err }, "Failed to update category");
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/categories/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const [cat] = await db.delete(categoriesTable).where(eq(categoriesTable.id, id)).returning();
    if (!cat) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete category");
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/posts/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const parsed = UpdatePostBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error" });

  try {
    const updateData: Record<string, unknown> = {};
    if (parsed.data.isPinned !== undefined) updateData.isPinned = parsed.data.isPinned;
    if (parsed.data.title) updateData.title = parsed.data.title;
    if (parsed.data.content) updateData.content = parsed.data.content;

    const [post] = await db.update(postsTable).set(updateData).where(eq(postsTable.id, id)).returning();
    if (!post) return res.status(404).json({ error: "Not found" });

    const [cat] = await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, post.categoryId));
    const [author] = post.authorId
      ? await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, post.authorId))
      : [];

    res.json({
      id: post.id,
      categoryId: post.categoryId,
      categoryName: cat?.name ?? "",
      title: post.title,
      content: post.content,
      authorName: author?.username ?? post.authorName,
      createdAt: post.createdAt.toISOString(),
      replyCount: post.replyCount,
      viewCount: post.viewCount,
      isPinned: post.isPinned,
      lastReplyAt: post.lastReplyAt ? post.lastReplyAt.toISOString() : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update post");
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/posts/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const [post] = await db.delete(postsTable).where(eq(postsTable.id, id)).returning();
    if (!post) return res.status(404).json({ error: "Not found" });

    await db.update(categoriesTable)
      .set({ postCount: sql`GREATEST(${categoriesTable.postCount} - 1, 0)` })
      .where(eq(categoriesTable.id, post.categoryId));

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete post");
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/replies/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const [reply] = await db.delete(repliesTable).where(eq(repliesTable.id, id)).returning();
    if (!reply) return res.status(404).json({ error: "Not found" });

    await db.update(postsTable)
      .set({ replyCount: sql`GREATEST(${postsTable.replyCount} - 1, 0)` })
      .where(eq(postsTable.id, reply.postId));

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete reply");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
