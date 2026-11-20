import { pgTable, serial, text, integer, timestamp, boolean, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";
import { usersTable } from "./auth";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  // The account that wrote it; the shown name comes from users.username at read time.
  authorId: varchar("author_id").references(() => usersTable.id, { onDelete: "set null" }),
  // Username snapshot at creation, shown only if the account is gone.
  authorName: text("author_name").notNull().default("Anonim"),
  replyCount: integer("reply_count").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  isPinned: boolean("is_pinned").notNull().default(false),
  lastReplyAt: timestamp("last_reply_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true, createdAt: true, replyCount: true, viewCount: true, lastReplyAt: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
