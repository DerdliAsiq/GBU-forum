import { db, notificationsTable, postsTable, repliesTable, type NotificationType } from "@workspace/db";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

/**
 * After `actorId` replies to `postId`, notify:
 *  - the topic author ("reply_to_post"), and
 *  - everyone else who has replied in that topic ("reply_in_thread"),
 * never the actor themself. While a recipient still has an unread
 * notification of the same kind for this topic, it is bumped (new actor,
 * reply and time) instead of piling up a new row for every reply.
 */
export async function notifyReply(postId: number, replyId: number, actorId: string): Promise<void> {
  const [post] = await db
    .select({ authorId: postsTable.authorId })
    .from(postsTable)
    .where(eq(postsTable.id, postId));
  if (!post) return;

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
