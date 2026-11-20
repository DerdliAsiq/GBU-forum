import type { Request } from "express";
import { db, postsTable, categoriesTable, repliesTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { likePattern, parsePaging as parsePagingQuery } from "./query";

export { likePattern };

export function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

/** Page/limit from the request's query string (see lib/query.ts). */
export function parsePaging(req: Request, options?: { defaultLimit?: number; maxLimit?: number }) {
  return parsePagingQuery(req.query as Record<string, unknown>, options);
}

/** Columns every topic response uses; the author name is always the current username. */
export const postFields = {
  id: postsTable.id,
  categoryId: postsTable.categoryId,
  categoryName: categoriesTable.name,
  title: postsTable.title,
  content: postsTable.content,
  authorId: postsTable.authorId,
  authorName: sql<string>`coalesce(${usersTable.username}, ${postsTable.authorName})`,
  createdAt: postsTable.createdAt,
  replyCount: postsTable.replyCount,
  viewCount: postsTable.viewCount,
  isPinned: postsTable.isPinned,
  lastReplyAt: postsTable.lastReplyAt,
  editedAt: postsTable.editedAt,
};

export function selectPosts() {
  return db
    .select(postFields)
    .from(postsTable)
    .innerJoin(categoriesTable, eq(postsTable.categoryId, categoriesTable.id))
    .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .$dynamic();
}

type PostRow = Awaited<ReturnType<typeof selectPosts>>[number];

export function serializePost(p: PostRow) {
  return {
    ...p,
    createdAt: p.createdAt.toISOString(),
    lastReplyAt: iso(p.lastReplyAt),
    editedAt: iso(p.editedAt),
  };
}

export const replyFields = {
  id: repliesTable.id,
  postId: repliesTable.postId,
  content: repliesTable.content,
  authorId: repliesTable.authorId,
  authorName: sql<string>`coalesce(${usersTable.username}, ${repliesTable.authorName})`,
  createdAt: repliesTable.createdAt,
  editedAt: repliesTable.editedAt,
};

export function selectReplies() {
  return db
    .select(replyFields)
    .from(repliesTable)
    .leftJoin(usersTable, eq(repliesTable.authorId, usersTable.id))
    .$dynamic();
}

type ReplyRow = Awaited<ReturnType<typeof selectReplies>>[number];

export function serializeReply(r: ReplyRow) {
  return { ...r, createdAt: r.createdAt.toISOString(), editedAt: iso(r.editedAt) };
}

/** May this user change content written by `authorId`? Its author or any admin. */
export function canModify(user: Express.User | undefined, authorId: string | null): boolean {
  return !!user && (user.isAdmin || (authorId != null && user.id === authorId));
}

/** Deletes a topic (replies, views, notifications, reports cascade) and fixes the category count. */
export async function deletePostById(id: number): Promise<boolean> {
  const [post] = await db.delete(postsTable).where(eq(postsTable.id, id)).returning();
  if (!post) return false;
  await db
    .update(categoriesTable)
    .set({ postCount: sql`GREATEST(${categoriesTable.postCount} - 1, 0)` })
    .where(eq(categoriesTable.id, post.categoryId));
  return true;
}

/** Deletes a reply and fixes the topic's reply count and "last reply" time. */
export async function deleteReplyById(id: number): Promise<boolean> {
  const [reply] = await db.delete(repliesTable).where(eq(repliesTable.id, id)).returning();
  if (!reply) return false;
  await db
    .update(postsTable)
    .set({
      replyCount: sql`GREATEST(${postsTable.replyCount} - 1, 0)`,
      lastReplyAt: sql`(select max(r.created_at) from replies r where r.post_id = ${reply.postId})`,
    })
    .where(eq(postsTable.id, reply.postId));
  return true;
}
