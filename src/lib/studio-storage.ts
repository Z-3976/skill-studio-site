import type { SkillId } from "@/lib/site-data";
import type { ResultMeta, ResultType, StudioMessage } from "@/lib/studio-types";

export type UserProfile = {
  storeName: string;
  location: string;
  themeColor: string;
  noteTone: string;
  storeTags: string;
  defaultAudience: string;
  coverStyle: string;
  topicWords: string;
};

export type HistoryRecord = {
  id: string;
  skillId: SkillId;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  starred: boolean;
  resultType: ResultType;
  messages: StudioMessage[];
  meta?: ResultMeta;
};

const PROFILE_KEY = "skill-studio-profile-v1";
const FALLBACK_HISTORY_KEY = "skill-studio-history-v1";
const DB_NAME = "skill-studio-db";
const DB_VERSION = 1;
const HISTORY_STORE = "history-records";

const emptyProfile: UserProfile = {
  storeName: "",
  location: "",
  themeColor: "",
  noteTone: "",
  storeTags: "",
  defaultAudience: "",
  coverStyle: "",
  topicWords: "",
};

const isBrowser = () => typeof window !== "undefined";

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (!isBrowser() || !window.indexedDB) {
      reject(new Error("indexeddb unavailable"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        db.createObjectStore(HISTORY_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("failed to open indexeddb"));
  });

const readFallbackHistory = () => {
  if (!isBrowser()) {
    return [] as HistoryRecord[];
  }

  try {
    const raw = window.localStorage.getItem(FALLBACK_HISTORY_KEY);
    if (!raw) {
      return [] as HistoryRecord[];
    }

    const parsed = JSON.parse(raw) as HistoryRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as HistoryRecord[];
  }
};

const writeFallbackHistory = (records: HistoryRecord[]) => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(FALLBACK_HISTORY_KEY, JSON.stringify(records));
};

export const loadUserProfile = (): UserProfile => {
  if (!isBrowser()) {
    return emptyProfile;
  }

  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) {
      return emptyProfile;
    }

    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      ...emptyProfile,
      ...parsed,
    };
  } catch {
    return emptyProfile;
  }
};

export const saveUserProfile = (profile: UserProfile) => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
};

export const loadHistoryRecords = async () => {
  try {
    const db = await openDb();

    const records = await new Promise<HistoryRecord[]>((resolve, reject) => {
      const tx = db.transaction(HISTORY_STORE, "readonly");
      const store = tx.objectStore(HISTORY_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve((request.result as HistoryRecord[]) || []);
      request.onerror = () => reject(request.error || new Error("failed to load history"));
    });

    return records.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  } catch {
    return readFallbackHistory().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }
};

export const saveHistoryRecord = async (record: HistoryRecord) => {
  try {
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(HISTORY_STORE, "readwrite");
      tx.objectStore(HISTORY_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("failed to save history"));
    });
  } catch {
    const records = readFallbackHistory();
    const nextRecords = [record, ...records.filter((item) => item.id !== record.id)].slice(0, 18);
    writeFallbackHistory(nextRecords);
  }
};

export const deleteHistoryRecord = async (id: string) => {
  try {
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(HISTORY_STORE, "readwrite");
      tx.objectStore(HISTORY_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("failed to delete history"));
    });
  } catch {
    const nextRecords = readFallbackHistory().filter((item) => item.id !== id);
    writeFallbackHistory(nextRecords);
  }
};
