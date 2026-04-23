import { Router } from "express";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SignupBody, LoginBody, UpdateProfileBody } from "@workspace/api-zod";
import { hashPassword, comparePassword, createSession, requireAuth, type AuthRequest } from "../lib/auth";

const isProd = process.env.NODE_ENV === "production";

/** Local http://localhost can't use SameSite=None + Secure cookies; the SPA still uses Bearer tokens from JSON. */
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: (isProd ? "none" : "lax") as const,
  secure: isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

const router = Router();

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
    createdAt: user.createdAt.toISOString(),
  });
});

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, name, password } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).then(r => r[0]);
  if (existing) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({ email, name, passwordHash }).returning();

  const token = await createSession(user.id);
  res.cookie("session", token, SESSION_COOKIE_OPTIONS);

  res.status(201).json({
    id: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
    token,
    createdAt: user.createdAt.toISOString(),
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const user = await db.select().from(usersTable).where(eq(usersTable.email, email)).then(r => r[0]);

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = await createSession(user.id);
  res.cookie("session", token, SESSION_COOKIE_OPTIONS);

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
    token,
    createdAt: user.createdAt.toISOString(),
  });
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  const cookieToken = req.cookies?.["session"] as string | undefined;
  const authHeader = req.headers["authorization"];
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const token = cookieToken ?? bearerToken;
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  res.clearCookie("session", SESSION_COOKIE_OPTIONS);
  res.sendStatus(204);
});

router.patch("/auth/profile", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthRequest).user;
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.tier !== undefined) updates.tier = parsed.data.tier;

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();

  res.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    tier: updated.tier,
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
