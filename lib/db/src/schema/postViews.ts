import { pgTable, integer, text, date, primaryKey, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { postsTable } from "./posts";

/**
 * De-duplicates topic views: one row per (post, viewer, day), so a viewer adds
 * at most one view per topic per day. viewer_key is "u:<user id>" or
 * "a:<HMAC of IP>" — raw IPs are never stored. Old days are pruned by the API.
 */
export const postViewsTable = pgTable(
  "post_views",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    viewerKey: text("viewer_key").notNull(),
    day: date("day").notNull().default(sql`current_date`),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.viewerKey, table.day] }),
    index("post_views_day_idx").on(table.day),
  ],
);
