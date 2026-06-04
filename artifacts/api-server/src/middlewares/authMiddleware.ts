import * as oidc from "openid-client";
import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  getSession,
  updateSession,
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

async function refreshIfExpired(
  sid: string,
  session: SessionData,
): Promise<SessionData> {
  const now = Math.floor(Date.now() / 1000);

  if (!session.expires_at || now <= session.expires_at) return session;

  if (session.localAdmin) return session;

  if (!session.refresh_token) {
    const updated = { ...session, expires_at: undefined };
    await updateSession(sid, updated);
    return updated;
  }

  try {
    const config = await getOidcConfig();
    const tokens = await oidc.refreshTokenGrant(config, session.refresh_token);
    session.access_token = tokens.access_token;
    session.refresh_token = tokens.refresh_token ?? session.refresh_token;
    session.expires_at = tokens.expiresIn()
      ? now + tokens.expiresIn()!
      : session.expires_at;
    await updateSession(sid, session);
    return session;
  } catch {
    const updated = { ...session, access_token: "", refresh_token: undefined, expires_at: undefined };
    await updateSession(sid, updated);
    return updated;
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

  const session = await getSession(sid);
  if (!session?.user?.id) {
    await clearSession(res, sid);
    next();
    return;
  }

  const refreshed = await refreshIfExpired(sid, session);

  const [dbUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, refreshed.user.id));

  if (dbUser?.isBanned) {
    await clearSession(res, sid);
    next();
    return;
  }

  req.user = {
    ...refreshed.user,
    isAdmin: dbUser?.isAdmin ?? refreshed.user.isAdmin,
    username: dbUser?.username ?? null,
    displayName: dbUser?.displayName ?? null,
    profileImageUrl: dbUser?.profileImageUrl ?? refreshed.user.profileImageUrl,
    isBanned: dbUser?.isBanned ?? false,
  };

  next();
}
