import { Router } from "express";
import { db, postsTable, repliesTable, reportsTable, REPORT_REASONS } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { rateLimit } from "../lib/rateLimit";
import { notifyAdminsOfReport } from "../lib/notifications";

const router = Router();
const reportLimiter = rateLimit(10, 60 * 60 * 1000);

// POST /reports { postId | replyId, reason, details? } — signed-in users report a topic or reply.
router.post("/reports", reportLimiter, async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Şikayət etmək üçün daxil olun" });

  const { postId, replyId, reason, details } = req.body ?? {};
  const hasPost = Number.isInteger(postId);
  const hasReply = Number.isInteger(replyId);
  if (hasPost === hasReply) return res.status(400).json({ error: "Mövzu və ya cavab seçilməlidir" });
  if (!REPORT_REASONS.includes(reason)) return res.status(400).json({ error: "Səbəb seçilməlidir" });
  if (details != null && (typeof details !== "string" || details.length > 500)) {
    return res.status(400).json({ error: "Açıqlama ən çox 500 simvol ola bilər" });
  }

  try {
    let topicId: number;
    let authorId: string | null;
    if (hasReply) {
      const [reply] = await db
        .select({ postId: repliesTable.postId, authorId: repliesTable.authorId })
        .from(repliesTable)
        .where(eq(repliesTable.id, replyId));
      if (!reply) return res.status(404).json({ error: "Not found" });
      topicId = reply.postId;
      authorId = reply.authorId;
    } else {
      const [post] = await db
        .select({ id: postsTable.id, authorId: postsTable.authorId })
        .from(postsTable)
        .where(eq(postsTable.id, postId));
      if (!post) return res.status(404).json({ error: "Not found" });
      topicId = post.id;
      authorId = post.authorId;
    }
    if (authorId === req.user.id) return res.status(400).json({ error: "Öz yazınızdan şikayət edə bilməzsiniz" });

    // One open report per user per piece of content.
    const [existing] = await db
      .select({ id: reportsTable.id })
      .from(reportsTable)
      .where(
        and(
          eq(reportsTable.reporterId, req.user.id),
          eq(reportsTable.status, "open"),
          hasReply ? eq(reportsTable.replyId, replyId) : eq(reportsTable.postId, postId),
        ),
      );
    if (existing) return res.status(200).json({ success: true, alreadyReported: true });

    await db.insert(reportsTable).values({
      reporterId: req.user.id,
      postId: hasPost ? postId : null,
      replyId: hasReply ? replyId : null,
      reason,
      details: details?.trim() || null,
    });

    await notifyAdminsOfReport(topicId, hasReply ? replyId : null, req.user.id).catch((err) =>
      req.log.error({ err }, "Failed to notify admins of report"),
    );
    res.status(201).json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to create report");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
