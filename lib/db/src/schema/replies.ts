import { pgTable, serial, text, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { postsTable } from "./posts";
import { usersTable } from "./auth";

export const repliesTable = pgTable("replies", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  // The account that wrote it; the shown name comes from users.username at read time.
  authorId: varchar("author_id").references(() => usersTable.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  authorName: text("author_name").notNull().default("Anonim"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReplySchema = createInsertSchema(repliesTable).omit({ id: true, createdAt: true });
export type InsertReply = z.infer<typeof insertReplySchema>;
export type Reply = typeof repliesTable.$inferSelect;
