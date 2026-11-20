import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getSessionId,
  getSession,
  refreshSessionIfDue,
  type SessionData,
} from "../lib/auth";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  const found = await getSession(sid);
  const session = found?.data;
  if (!found || !session?.user?.id) {
    await clearSession(res, sid);
    next();
    return;
  }

  const [dbUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.user.id));

  // Account deleted or banned: end the session.
  if (!dbUser || dbUser.isBanned) {
    await clearSession(res, sid);
    next();
    return;
  }

  // Keep active users signed in (sliding 30-day expiry). Never fail the
  // request because of this housekeeping write.
  await refreshSessionIfDue(res, sid, found).catch((err) =>
    req.log.warn({ err }, "Failed to extend session"),
  );

  req.user = {
    ...session.user,
    isAdmin: dbUser?.isAdmin ?? session.user.isAdmin,
    username: dbUser?.username ?? null,
    displayName: dbUser?.displayName ?? null,
    profileImageUrl: dbUser?.profileImageUrl ?? session.user.profileImageUrl,
    isBanned: dbUser?.isBanned ?? false,
  };

  next();
}
