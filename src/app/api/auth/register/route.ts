import { NextResponse } from "next/server";
import { createPasswordRecord } from "@/lib/server-auth";
import { createUser, findUserByUsername } from "@/lib/server-store";

const normalizeUsername = (value: string) => value.trim().toLowerCase();

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  const username = normalizeUsername(body?.username || "");
  const password = (body?.password || "").trim();

  if (username.length < 3) {
    return NextResponse.json({ error: "用户名至少 3 位。" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "密码至少 6 位。" }, { status: 400 });
  }

  const existing = await findUserByUsername(username);
  if (existing) {
    return NextResponse.json({ error: "这个账号已经注册过了。" }, { status: 409 });
  }

  const passwordRecord = createPasswordRecord(password);
  await createUser({
    username,
    passwordHash: passwordRecord.hash,
    passwordSalt: passwordRecord.salt,
  });

  return NextResponse.json({ ok: true });
}
