import crypto from "node:crypto";
import type { Request } from "express";
import { db, postViewsTable, postsTable } from "@workspace/db";
import { eq, lt, sql } from "drizzle-orm";
import { clientKey } from "./rateLimit";

// Keyed hash so stored viewer keys can't be reversed to IPs by brute force.
// DATABASE_URL is secret and stable across restarts, so it is a usable default.
const VIEW_HASH_KEY = process.env.VIEW_HASH_SALT || process.env.DATABASE_URL || "dev-only";

function viewerKey(req: Request): string {
  if (req.user?.id) return `u:${req.user.id}`;
  const digest = crypto.createHmac("sha256", VIEW_HASH_KEY).update(clientKey(req)).digest("base64url");
  return `a:${digest.slice(0, 32)}`;
}

/**
 * Counts a view of `postId` unless this viewer already viewed it today.
 * Returns true when the view counter was incremented.
 */
export async function recordPostView(req: Request, postId: number): Promise<boolean> {
  const inserted = await db
    .insert(postViewsTable)
    .values({ postId, viewerKey: viewerKey(req) })
    .onConflictDoNothing()
    .returning({ postId: postViewsTable.postId });

  if (inserted.length === 0) return false;

  await db
    .update(postsTable)
    .set({ viewCount: sql`${postsTable.viewCount} + 1` })
    .where(eq(postsTable.id, postId));

  // Rows from before yesterday can never block a view again; prune now and then.
  if (Math.random() < 0.02) {
    db.delete(postViewsTable)
      .where(lt(postViewsTable.day, sql`current_date - 1`))
      .catch((err) => req.log.warn({ err }, "Failed to prune post_views"));
  }
  return true;
}
