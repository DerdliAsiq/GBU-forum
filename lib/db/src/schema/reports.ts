import { pgTable, serial, varchar, integer, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./auth";
import { postsTable } from "./posts";
import { repliesTable } from "./replies";

/**
 * Content reports ("Şikayət et"). Exactly one of postId / replyId is set.
 * status: "open" | "resolved" (content removed) | "dismissed".
 */
export const reportsTable = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    reporterId: varchar("reporter_id").references(() => usersTable.id, { onDelete: "set null" }),
    postId: integer("post_id").references(() => postsTable.id, { onDelete: "cascade" }),
    replyId: integer("reply_id").references(() => repliesTable.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").notNull().default("open"),
    resolvedBy: varchar("resolved_by").references(() => usersTable.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("reports_status_created_idx").on(table.status, table.createdAt),
    // One open report per item: later reporters get "already reported".
    uniqueIndex("reports_one_open_per_item")
      .on(sql`coalesce(${table.postId}, 0)`, sql`coalesce(${table.replyId}, 0)`)
      .where(sql`${table.status} = 'open'`),
  ],
);

export const REPORT_REASONS = ["spam", "insult", "inappropriate", "off_topic", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
