import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { validateDisplayName, validatePassword, validateUsername } from "../lib/userValidation";
import { deleteOtherSessions, getSessionId } from "../lib/auth";
import { rateLimit } from "../lib/rateLimit";

const router = Router();
const passwordLimiter = rateLimit(10, 15 * 60 * 1000);

// The browser resizes avatars to ~256px JPEG before upload (well under this cap).
const MAX_AVATAR_DATA_URL = 280_000;
const AVATAR_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

/** null = remove avatar; otherwise must be a small inline image or an https URL. */
function validateAvatar(value: string): string | null | Error {
  if (value === "") return null;
  if (value.startsWith("data:")) {
    if (value.length > MAX_AVATAR_DATA_URL) return new Error("Şəkil çox böyükdür");
    if (!AVATAR_DATA_URL.test(value)) return new Error("Yalnız PNG, JPEG, WebP və ya GIF şəkil");
    return value;
  }
  if (/^https:\/\/[^\s"'<>]+$/.test(value) && value.length <= 500) return value;
  return new Error("Şəkil ünvanı yanlışdır");
}

const UpdateProfileBody = z.object({
  username: z.string().optional(),
  displayName: z.string().optional(),
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

  // Admins may keep staff-like names (e.g. "Admin"); everyone else may not.
  const allowReserved = req.user.isAdmin;
  const nameError =
    (username !== undefined ? validateUsername(username, { allowReserved }) : null) ??
    (displayName !== undefined ? validateDisplayName(displayName, { allowReserved }) : null);
  if (nameError) {
    return res.status(400).json({ error: nameError });
  }
  const avatar = profileImageUrl !== undefined ? validateAvatar(profileImageUrl) : undefined;
  if (avatar instanceof Error) {
    return res.status(400).json({ error: avatar.message });
  }

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
  if (avatar !== undefined) updateData.profileImageUrl = avatar;

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

// PUT /profile/password { currentPassword, newPassword } — also signs out the user's other sessions.
router.put("/profile/password", passwordLimiter, async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return res.status(400).json({ error: "Cari və yeni şifrə tələb olunur" });
  }
  const weak = validatePassword(newPassword);
  if (weak) return res.status(400).json({ error: weak });

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
    if (!user?.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(400).json({ error: "Cari şifrə yanlışdır" });
    }
    await db
      .update(usersTable)
      .set({ passwordHash: await bcrypt.hash(newPassword, 12), updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));
    await deleteOtherSessions(user.id, getSessionId(req));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to change password");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
