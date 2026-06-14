import type { HistoryRecord, StudioState, UserProfile } from "@/lib/studio-types";

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

export const getEmptyProfile = () => emptyProfile;

const jsonHeaders = {
  "Content-Type": "application/json",
};

export const loadStudioState = async (): Promise<StudioState> => {
  const response = await fetch("/api/studio/state", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("load state failed");
  }

  return (await response.json()) as StudioState;
};

export const saveUserProfile = async (profile: UserProfile) => {
  const response = await fetch("/api/studio/profile", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(profile),
  });

  if (!response.ok) {
    throw new Error("save profile failed");
  }
};

export const saveHistoryRecord = async (record: HistoryRecord) => {
  const response = await fetch("/api/studio/history", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    throw new Error("save history failed");
  }
};

export const deleteHistoryRecord = async (id: string) => {
  const response = await fetch(`/api/studio/history?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("delete history failed");
  }
};
