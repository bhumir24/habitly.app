import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import onboardingRouter from "./onboarding";
import habitsRouter from "./habits";
import logsRouter from "./logs";
import coachRouter from "./coach";
import insightsRouter from "./insights";
import remindersRouter from "./reminders";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(onboardingRouter);
router.use(habitsRouter);
router.use(logsRouter);
router.use(coachRouter);
router.use(insightsRouter);
router.use(remindersRouter);
router.use(dashboardRouter);

export default router;
