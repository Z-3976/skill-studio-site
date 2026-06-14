import { NextResponse } from "next/server";
import { buildSessionCookie, createSessionToken, verifyPassword } from "@/lib/server-auth";
import { findUserByUsername } from "@/lib/server-store";

const normalizeUsername = (value: string) => value.trim().toLowerCase();

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  const username = normalizeUsername(body?.username || "");
  const password = (body?.password || "").trim();

  if (!username || !password) {
    return NextResponse.json({ error: "请输入账号和密码。" }, { status: 400 });
  }

  const user = await findUserByUsername(username);
  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return NextResponse.json({ error: "账号或密码不正确。" }, { status: 401 });
  }

  const session = await createSessionToken(user.id);
  const response = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
    },
  });

  const cookie = buildSessionCookie(session.token, session.expiresAt, request.url);
  response.cookies.set(cookie.name, cookie.value, cookie.options);

  return response;
}
