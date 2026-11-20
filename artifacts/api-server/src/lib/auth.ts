import crypto from "crypto";
import { type Request, type Response } from "express";
import { db, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthUser } from "@workspace/api-zod";

export const SESSION_COOKIE = "sid";
const DAY = 24 * 60 * 60 * 1000;
/** Sessions last 30 days and roll: activity pushes the expiry forward again. */
export const SESSION_TTL = 30 * DAY;
/** Re-extend at most once a day per session, to avoid a write on every request. */
const SESSION_REFRESH_AFTER = DAY;

export function setSessionCookie(res: Response, sid: string): void {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

export interface SessionData {
  user: AuthUser;
}

export async function createSession(data: SessionData): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    sid,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export async function getSession(
  sid: string,
): Promise<{ data: SessionData; expire: Date } | null> {
  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sid, sid));

  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }

  return { data: row.sess as unknown as SessionData, expire: row.expire };
}

/**
 * Sliding expiry: once a session has been used more than a day after it was
 * last extended, push both the DB expiry and the cookie 30 days out again.
 */
export async function refreshSessionIfDue(
  res: Response,
  sid: string,
  session: { data: SessionData; expire: Date },
): Promise<void> {
  const lastExtended = session.expire.getTime() - SESSION_TTL;
  if (Date.now() - lastExtended < SESSION_REFRESH_AFTER) return;
  await updateSession(sid, session.data);
  setSessionCookie(res, sid);
}

export async function updateSession(
  sid: string,
  data: SessionData,
): Promise<void> {
  await db
    .update(sessionsTable)
    .set({
      sess: data as unknown as Record<string, unknown>,
      expire: new Date(Date.now() + SESSION_TTL),
    })
    .where(eq(sessionsTable.sid, sid));
}

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export async function clearSession(
  res: Response,
  sid?: string,
): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function getSessionId(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies?.[SESSION_COOKIE];
}
