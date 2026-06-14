import { NextResponse } from "next/server";
import { buildExpiredSessionCookie, clearSessionToken } from "@/lib/server-auth";

export async function POST(request: Request) {
  const token = request.headers.get("cookie")?.match(/skill_studio_session=([^;]+)/)?.[1];
  await clearSessionToken(token);

  const response = NextResponse.json({ ok: true });
  const cookie = buildExpiredSessionCookie(request.url);
  response.cookies.set(cookie.name, cookie.value, cookie.options);

  return response;
}
