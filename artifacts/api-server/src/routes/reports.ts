import { Router } from "express";
import { db, postsTable, repliesTable, reportsTable, REPORT_REASONS } from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
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
    let editedAt: Date | null;
    if (hasReply) {
      const [reply] = await db
        .select({ postId: repliesTable.postId, authorId: repliesTable.authorId, editedAt: repliesTable.editedAt })
        .from(repliesTable)
        .where(eq(repliesTable.id, replyId));
      if (!reply) return res.status(404).json({ error: "Not found" });
      ({ postId: topicId, authorId, editedAt } = reply);
    } else {
      const [post] = await db
        .select({ id: postsTable.id, authorId: postsTable.authorId, editedAt: postsTable.editedAt })
        .from(postsTable)
        .where(eq(postsTable.id, postId));
      if (!post) return res.status(404).json({ error: "Not found" });
      ({ id: topicId, authorId, editedAt } = post);
    }
    if (authorId === req.user.id) return res.status(400).json({ error: "Öz yazınızdan şikayət edə bilməzsiniz" });

    // Anti-spam: each item gets reviewed once. While a report is open nobody can
    // add another (and admins aren't notified again). After an admin dismissed it,
    // it stays closed unless the author edited the content since that review.
    const sameItem = hasReply ? eq(reportsTable.replyId, replyId) : eq(reportsTable.postId, postId);
    const [lastReview] = await db
      .select({ status: reportsTable.status, resolvedAt: reportsTable.resolvedAt })
      .from(reportsTable)
      .where(and(sameItem, inArray(reportsTable.status, ["open", "dismissed"])))
      .orderBy(desc(reportsTable.createdAt))
      .limit(1);
    if (lastReview?.status === "open") {
      return res.status(200).json({ success: true, alreadyReported: true });
    }
    if (
      lastReview?.status === "dismissed" &&
      !(editedAt && lastReview.resolvedAt && editedAt > lastReview.resolvedAt)
    ) {
      return res.status(409).json({ error: "Bu məzmun artıq yoxlanılıb və qaydalara uyğun hesab edilib", alreadyReviewed: true });
    }

    // The partial unique index (one open report per item) settles simultaneous reports.
    const inserted = await db
      .insert(reportsTable)
      .values({
        reporterId: req.user.id,
        postId: hasPost ? postId : null,
        replyId: hasReply ? replyId : null,
        reason,
        details: details?.trim() || null,
      })
      .onConflictDoNothing()
      .returning({ id: reportsTable.id });
    if (inserted.length === 0) return res.status(200).json({ success: true, alreadyReported: true });

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
