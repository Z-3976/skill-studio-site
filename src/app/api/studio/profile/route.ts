import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { upsertProfile } from "@/lib/server-store";
import type { UploadAsset, UserProfile } from "@/lib/studio-types";

const emptyProfile: UserProfile = {
  storeName: "",
  location: "",
  storeHighlights: "",
  mainOfferPrice: "",
  mainOfferContent: "",
  logoAssets: [],
  themeColor: "",
  redemptionGift7d: "",
};

const isUploadAsset = (value: unknown): value is UploadAsset =>
  Boolean(
    value &&
      typeof value === "object" &&
      "name" in value &&
      "dataUrl" in value &&
      "mediaType" in value &&
      typeof (value as UploadAsset).name === "string" &&
      typeof (value as UploadAsset).dataUrl === "string" &&
      typeof (value as UploadAsset).mediaType === "string",
  );

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Partial<UserProfile> | null;
  const profile: UserProfile = {
    ...emptyProfile,
    ...(body || {}),
    logoAssets: Array.isArray(body?.logoAssets) ? body.logoAssets.filter(isUploadAsset) : [],
  };

  await upsertProfile(user.id, profile);

  return NextResponse.json({ ok: true });
}
