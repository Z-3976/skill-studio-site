import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { listHistory, loadProfile } from "@/lib/server-store";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  const [profile, history] = await Promise.all([loadProfile(user.id), listHistory(user.id)]);

  return NextResponse.json({
    user,
    profile,
    history,
  });
}
