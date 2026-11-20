import { Router } from "express";
import { db, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/categories", async (req, res) => {
  try {
    const categories = await db
      .select()
      .from(categoriesTable)
      .orderBy(categoriesTable.id);
    res.json(categories.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      slug: c.slug,
      icon: c.icon ?? null,
      postCount: c.postCount,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list categories");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/categories/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id));
    if (!cat) return res.status(404).json({ error: "Not found" });
    res.json({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      slug: cat.slug,
      icon: cat.icon ?? null,
      postCount: cat.postCount,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get category");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
