import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const UpdateProfileBody = z.object({
  username: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_\-\.ğüşıöçĞÜŞİÖÇ]+$/, "Yalnız hərf, rəqəm və _ simvollarına icazə verilir").optional(),
  displayName: z.string().min(1).max(100).optional(),
  profileImageUrl: z.string().optional(),
});

router.get("/profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
  if (!user) return res.status(404).json({ error: "User not found" });

  return res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    isAdmin: user.isAdmin,
    isBanned: user.isBanned,
    createdAt: user.createdAt.toISOString(),
  });
});

router.put("/profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation error", details: parsed.error.issues });
  }

  const { username, displayName, profileImageUrl } = parsed.data;

  if (username) {
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.username, username));
    if (existing && existing.id !== req.user.id) {
      return res.status(409).json({ error: "Bu istifadəçi adı artıq istifadə olunur" });
    }
  }

  const updateData: Partial<typeof usersTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (username !== undefined) updateData.username = username;
  if (displayName !== undefined) updateData.displayName = displayName;
  if (profileImageUrl !== undefined) updateData.profileImageUrl = profileImageUrl;

  const [updated] = await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, req.user.id))
    .returning();

  if (!updated) return res.status(404).json({ error: "User not found" });

  return res.json({
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
});

export default router;
