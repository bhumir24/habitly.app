import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db, sessionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import type { User } from "@workspace/db";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(userId: number): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(sessionsTable).values({ userId, token, expiresAt });
  return token;
}

export async function getUserFromToken(token: string): Promise<User | null> {
  const session = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.token, token))
    .then((rows) => rows[0] ?? null);

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
    return null;
  }

  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.userId))
    .then((rows) => rows[0] ?? null);

  return user;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Accept token from cookie OR Authorization: Bearer header
  const cookieToken = req.cookies?.["session"] as string | undefined;
  const authHeader = req.headers["authorization"];
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const token = cookieToken ?? bearerToken;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await getUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  (req as Request & { user: User }).user = user;
  next();
}

export type AuthRequest = Request & { user: User };
