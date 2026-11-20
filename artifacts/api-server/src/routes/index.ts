import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import categoriesRouter from "./categories";
import postsRouter from "./posts";
import repliesRouter from "./replies";
import statsRouter from "./stats";
import adminRouter from "./admin";
import profileRouter from "./profile";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(categoriesRouter);
router.use(postsRouter);
router.use(repliesRouter);
router.use(statsRouter);
router.use(adminRouter);
router.use(profileRouter);
router.use(notificationsRouter);

export default router;
