import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createSession, deleteSession, findSession, findUserById, pruneExpiredSessions } from "@/lib/server-store";
import type { AuthUser } from "@/lib/studio-types";

const SESSION_COOKIE = "skill_studio_session";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const hashPassword = (password: string, salt: string) =>
  scryptSync(password, salt, 64).toString("hex");

export const createPasswordRecord = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);

  return {
    salt,
    hash,
  };
};

export const verifyPassword = (password: string, salt: string, expectedHash: string) => {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
};

export const createSessionToken = async (userId: string) => {
  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE).toISOString();

  await createSession({
    tokenHash: hashToken(rawToken),
    userId,
    expiresAt,
  });

  return {
    token: rawToken,
    expiresAt,
  };
};

export const clearSessionToken = async (token: string | undefined) => {
  if (!token) {
    return;
  }

  await deleteSession(hashToken(token));
};

const toAuthUser = (input: { id: string; username: string }): AuthUser => ({
  id: input.id,
  username: input.username,
});

export const getCurrentUser = async (): Promise<AuthUser | null> => {
  await pruneExpiredSessions();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await findSession(hashToken(token));
  if (!session) {
    return null;
  }

  const user = await findUserById(session.userId);
  if (!user) {
    return null;
  }

  return toAuthUser(user);
};

const shouldUseSecureCookie = (requestUrl?: string) => {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  if (!requestUrl) {
    return true;
  }

  try {
    const url = new URL(requestUrl);
    const host = url.hostname.toLowerCase();
    const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
    return url.protocol === "https:" && !isLocalHost;
  } catch {
    return true;
  }
};

export const buildSessionCookie = (token: string, expiresAt: string, requestUrl?: string) => ({
  name: SESSION_COOKIE,
  value: token,
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookie(requestUrl),
    path: "/",
    expires: new Date(expiresAt),
  },
});

export const buildExpiredSessionCookie = (requestUrl?: string) => ({
  name: SESSION_COOKIE,
  value: "",
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookie(requestUrl),
    path: "/",
    expires: new Date(0),
  },
});
