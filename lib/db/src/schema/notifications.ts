import { pgTable, serial, varchar, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { postsTable } from "./posts";
import { repliesTable } from "./replies";

/**
 * In-app notifications. `userId` is the recipient, `actorId` who triggered it.
 * Types: "reply_to_post" (someone replied to your topic) and
 * "reply_in_thread" (someone replied in a topic you also replied to).
 */
export const notificationsTable = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    actorId: varchar("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    postId: integer("post_id").references(() => postsTable.id, { onDelete: "cascade" }),
    replyId: integer("reply_id").references(() => repliesTable.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("notifications_user_created_idx").on(table.userId, table.createdAt)],
);

export type NotificationType = "reply_to_post" | "reply_in_thread";
