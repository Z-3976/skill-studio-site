import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { deleteHistory, saveHistory } from "@/lib/server-store";
import type { HistoryRecord } from "@/lib/studio-types";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as HistoryRecord | null;

  if (!body?.id) {
    return NextResponse.json({ error: "缺少历史记录。" }, { status: 400 });
  }

  await saveHistory(user.id, body);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();

  if (!id) {
    return NextResponse.json({ error: "缺少记录 ID。" }, { status: 400 });
  }

  await deleteHistory(user.id, id);
  return NextResponse.json({ ok: true });
}
