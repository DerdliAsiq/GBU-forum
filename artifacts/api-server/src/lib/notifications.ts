import {
  db,
  notificationsTable,
  postsTable,
  repliesTable,
  usersTable,
  type NotificationType,
} from "@workspace/db";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { extractMentions } from "./mentions";

/**
 * Creates a notification, or — while the recipient still has an unread one of
 * the same type for the same topic — bumps that one (new actor, reply and
 * time) so an active topic doesn't pile up a row per reply.
 */
async function upsertNotification(
  userId: string,
  type: NotificationType,
  postId: number,
  actorId: string | null,
  replyId: number | null,
): Promise<void> {
  const bumped = await db
    .update(notificationsTable)
    .set({ actorId, replyId, createdAt: new Date() })
    .where(
      and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.postId, postId),
        eq(notificationsTable.type, type),
        isNull(notificationsTable.readAt),
      ),
    )
    .returning({ id: notificationsTable.id });
  if (bumped.length === 0) {
    await db.insert(notificationsTable).values({ userId, actorId, type, postId, replyId });
  }
}

/**
 * After `actorId` replies to `postId`, notify the topic author
 * ("reply_to_post") and everyone else who replied there ("reply_in_thread"),
 * never the actor. Returns who was notified, so mentions don't double up.
 */
export async function notifyReply(postId: number, replyId: number, actorId: string): Promise<Set<string>> {
  const [post] = await db
    .select({ authorId: postsTable.authorId })
    .from(postsTable)
    .where(eq(postsTable.id, postId));
  if (!post) return new Set();

  const participants = await db
    .selectDistinct({ authorId: repliesTable.authorId })
    .from(repliesTable)
    .where(and(eq(repliesTable.postId, postId), isNotNull(repliesTable.authorId)));

  const recipients = new Map<string, NotificationType>();
  for (const { authorId } of participants) {
    if (authorId) recipients.set(authorId, "reply_in_thread");
  }
  if (post.authorId) recipients.set(post.authorId, "reply_to_post");
  recipients.delete(actorId);

  for (const [userId, type] of recipients) {
    await upsertNotification(userId, type, postId, actorId, replyId);
  }
  return new Set(recipients.keys());
}

/** Notifies users @mentioned in `text` (skipping the actor and anyone in `alreadyNotified`). */
export async function notifyMentions(
  text: string,
  postId: number,
  replyId: number | null,
  actorId: string,
  alreadyNotified: Set<string> = new Set(),
): Promise<void> {
  const names = extractMentions(text);
  if (names.length === 0) return;
  const users = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(inArray(usersTable.username, names), eq(usersTable.isBanned, false)));
  for (const { id } of users) {
    if (id === actorId || alreadyNotified.has(id)) continue;
    await upsertNotification(id, "mention", postId, actorId, replyId);
  }
}

/** Tells every admin that content in `postId` was reported. */
export async function notifyAdminsOfReport(postId: number, replyId: number | null, reporterId: string): Promise<void> {
  const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.isAdmin, true));
  for (const { id } of admins) {
    if (id === reporterId) continue;
    await upsertNotification(id, "report", postId, reporterId, replyId);
  }
}

/** Marks the user's unread notifications about `postId` as read (they opened it). */
export async function markPostNotificationsRead(userId: string, postId: number): Promise<void> {
  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.postId, postId),
        isNull(notificationsTable.readAt),
      ),
    );
}
