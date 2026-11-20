import bcrypt from "bcryptjs";
import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getSessionId,
  createSession,
  deleteSession,
  setSessionCookie,
  type SessionData,
} from "../lib/auth";
import { logger } from "../lib/logger";
import { validateDisplayName, validatePassword, validateUsername } from "../lib/userValidation";
import { RateLimiter, clientKey, rateLimit, sendTooMany } from "../lib/rateLimit";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME?.trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const FIFTEEN_MINUTES = 15 * 60 * 1000;
// Per address: caps password spraying across many usernames.
const loginIpLimiter = new RateLimiter(20, FIFTEEN_MINUTES);
// Per address + username: caps guessing one account without letting a stranger
// lock that account out for everyone else.
const loginAccountLimiter = new RateLimiter(5, FIFTEEN_MINUTES);
// Registration: typos and taken usernames must not lock people out, so only
// accounts actually created count toward the per-address cap; a much looser
// cap on all attempts just stops hammering.
const registerAttemptLimiter = rateLimit(30, FIFTEEN_MINUTES);
const accountsCreatedLimiter = new RateLimiter(5, 60 * 60 * 1000);

// Compared against when the user does not exist, so that path costs as much as
// a real password check and response time does not reveal valid usernames.
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  return (dummyHash ??= bcrypt.hash("timing-equaliser-not-a-password", 12));
}
void getDummyHash();

export async function seedAdminUser() {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    logger.warn("ADMIN_USERNAME / ADMIN_PASSWORD not set: skipping admin seed");
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, ADMIN_USERNAME));

    if (!existing) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await db.insert(usersTable).values({
        username: ADMIN_USERNAME,
        displayName: "Admin",
        passwordHash: hash,
        isAdmin: true,
        isBanned: false,
      });
    } else {
      // The env vars are the source of truth for the admin account: changing
      // ADMIN_PASSWORD and restarting rotates the password. Note that every
      // environment sharing this database (local + Render) must use the same
      // value, or whichever started last wins.
      const passwordMatches =
        !!existing.passwordHash && (await bcrypt.compare(ADMIN_PASSWORD, existing.passwordHash));
      if (!passwordMatches || !existing.isAdmin || existing.isBanned) {
        await db
          .update(usersTable)
          .set({
            passwordHash: passwordMatches ? existing.passwordHash : await bcrypt.hash(ADMIN_PASSWORD, 12),
            isAdmin: true,
            isBanned: false,
            updatedAt: new Date(),
          })
          .where(eq(usersTable.id, existing.id));
        logger.info({ passwordChanged: !passwordMatches }, "Admin account synced from env");
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed admin user");
  }
}

const router: IRouter = Router();

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.post("/auth/local-login", async (req: Request, res: Response) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    res.status(400).json({ error: "İstifadəçi adı və şifrə tələb olunur" });
    return;
  }

  const ip = clientKey(req);
  const accountKey = `${ip}|${username.toLowerCase()}`;
  const wait = Math.max(loginIpLimiter.hit(ip), loginAccountLimiter.hit(accountKey));
  if (wait) {
    sendTooMany(res, wait);
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username));

    const valid = await bcrypt.compare(
      password,
      user?.passwordHash ?? (await getDummyHash()),
    );
    if (!user || !user.passwordHash || !valid) {
      res.status(401).json({ error: "İstifadəçi adı və ya şifrə yanlışdır" });
      return;
    }
    loginAccountLimiter.reset(accountKey);

    if (user.isBanned) {
      res.status(403).json({ error: "Bu hesab bloklanmışdır" });
      return;
    }

    const sessionData: SessionData = {
      user: {
        id: user.id,
        email: user.email ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        profileImageUrl: user.profileImageUrl ?? null,
        isAdmin: user.isAdmin,
        username: user.username ?? null,
        displayName: user.displayName ?? null,
        isBanned: user.isBanned,
      },
    };

    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Local login error");
    res.status(500).json({ error: "Daxili xəta" });
  }
});

router.post("/auth/register", registerAttemptLimiter, async (req: Request, res: Response) => {
  const { username, password, displayName } = req.body ?? {};
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    (displayName != null && typeof displayName !== "string") ||
    !username ||
    !password
  ) {
    res.status(400).json({ error: "İstifadəçi adı və şifrə tələb olunur" });
    return;
  }

  const validationError =
    validateUsername(username) ??
    validatePassword(password) ??
    (displayName ? validateDisplayName(displayName) : null);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const ip = clientKey(req);
  const createdWait = accountsCreatedLimiter.check(ip);
  if (createdWait) {
    sendTooMany(res, createdWait);
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username));
    if (existing) {
      res.status(409).json({ error: "Bu istifadəçi adı artıq istifadə olunur" });
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(usersTable)
      .values({
        username,
        displayName: displayName ?? null,
        passwordHash: hash,
        isAdmin: false,
        isBanned: false,
      })
      .returning();
    accountsCreatedLimiter.hit(ip);

    const sessionData: SessionData = {
      user: {
        id: user.id,
        email: user.email ?? null,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        profileImageUrl: user.profileImageUrl ?? null,
        isAdmin: user.isAdmin,
        username: user.username ?? null,
        displayName: user.displayName ?? null,
        isBanned: user.isBanned,
      },
    };

    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);
    res.status(201).json({ success: true, user: sessionData.user });
  } catch (err) {
    req.log.error({ err }, "Register error");
    res.status(500).json({ error: "Daxili xəta" });
  }
});

// POST only: a GET logout could be triggered by any other site (img tag, link prefetch).
router.post("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.status(204).send();
});

export default router;
