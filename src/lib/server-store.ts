import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { HistoryRecord, UploadAsset, UserProfile } from "@/lib/studio-types";

type StoredUser = {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  updatedAt: string;
};

type StoredSession = {
  id: string;
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

type StoredProfile = UserProfile & {
  userId: string;
  updatedAt: string;
};

type StoredHistory = HistoryRecord & {
  userId: string;
};

type StoreShape = {
  users: StoredUser[];
  sessions: StoredSession[];
  profiles: StoredProfile[];
  history: StoredHistory[];
};

const STORE_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "skill-studio-data")
  : path.join(process.cwd(), "data");
const STORE_PATH = path.join(STORE_DIR, "skill-studio.json");

const emptyProfile = (): UserProfile => ({
  storeName: "",
  location: "",
  storeHighlights: "",
  mainOfferPrice: "",
  mainOfferContent: "",
  logoAssets: [],
  themeColor: "",
  redemptionGift7d: "",
});

const createEmptyStore = (): StoreShape => ({
  users: [],
  sessions: [],
  profiles: [],
  history: [],
});

let writeQueue = Promise.resolve();

const ensureStoreFile = async () => {
  await mkdir(STORE_DIR, { recursive: true });

  try {
    await readFile(STORE_PATH, "utf8");
  } catch {
    await writeFile(STORE_PATH, JSON.stringify(createEmptyStore(), null, 2), "utf8");
  }
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

const sanitizeAssets = (value: unknown) => (Array.isArray(value) ? value.filter(isUploadAsset) : []);

const sanitizeStore = (parsed: Partial<StoreShape>): StoreShape => ({
  users: Array.isArray(parsed.users) ? parsed.users : [],
  sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
  profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
  history: Array.isArray(parsed.history) ? parsed.history : [],
});

const mapStoredProfile = (profile: Record<string, unknown>): UserProfile => ({
  storeName: typeof profile.storeName === "string" ? profile.storeName : "",
  location: typeof profile.location === "string" ? profile.location : "",
  storeHighlights:
    typeof profile.storeHighlights === "string"
      ? profile.storeHighlights
      : typeof profile.storeTags === "string"
        ? profile.storeTags
        : "",
  mainOfferPrice: typeof profile.mainOfferPrice === "string" ? profile.mainOfferPrice : "",
  mainOfferContent: typeof profile.mainOfferContent === "string" ? profile.mainOfferContent : "",
  logoAssets: sanitizeAssets(profile.logoAssets),
  themeColor: typeof profile.themeColor === "string" ? profile.themeColor : "",
  redemptionGift7d: typeof profile.redemptionGift7d === "string" ? profile.redemptionGift7d : "",
});

export const readStore = async (): Promise<StoreShape> => {
  await ensureStoreFile();
  const raw = await readFile(STORE_PATH, "utf8");

  try {
    return sanitizeStore(JSON.parse(raw) as Partial<StoreShape>);
  } catch {
    const empty = createEmptyStore();
    await writeFile(STORE_PATH, JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
};

const writeStore = async (store: StoreShape) => {
  await ensureStoreFile();
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
};

export const updateStore = async <T>(mutator: (store: StoreShape) => Promise<T> | T): Promise<T> => {
  let result!: T;

  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const store = await readStore();
    result = await mutator(store);
    await writeStore(store);
  });

  await writeQueue;
  return result;
};

export const findUserByUsername = async (username: string) => {
  const store = await readStore();
  return store.users.find((user) => user.username.toLowerCase() === username.toLowerCase()) || null;
};

export const findUserById = async (userId: string) => {
  const store = await readStore();
  return store.users.find((user) => user.id === userId) || null;
};

export const createUser = async (input: {
  username: string;
  passwordHash: string;
  passwordSalt: string;
}) =>
  updateStore((store) => {
    const now = new Date().toISOString();
    const user: StoredUser = {
      id: randomUUID(),
      username: input.username,
      passwordHash: input.passwordHash,
      passwordSalt: input.passwordSalt,
      createdAt: now,
      updatedAt: now,
    };

    store.users.push(user);
    store.profiles.push({
      userId: user.id,
      updatedAt: now,
      ...emptyProfile(),
    });

    return user;
  });

export const upsertProfile = async (userId: string, profile: UserProfile) =>
  updateStore((store) => {
    const now = new Date().toISOString();
    const nextProfile: StoredProfile = {
      userId,
      updatedAt: now,
      ...emptyProfile(),
      ...profile,
      logoAssets: sanitizeAssets(profile.logoAssets),
    };

    const index = store.profiles.findIndex((item) => item.userId === userId);
    if (index >= 0) {
      store.profiles[index] = nextProfile;
    } else {
      store.profiles.push(nextProfile);
    }

    return nextProfile;
  });

export const loadProfile = async (userId: string): Promise<UserProfile> => {
  const store = await readStore();
  const profile = store.profiles.find((item) => item.userId === userId);
  if (!profile) {
    return emptyProfile();
  }

  return mapStoredProfile(profile as unknown as Record<string, unknown>);
};

export const listHistory = async (userId: string) => {
  const store = await readStore();

  return store.history
    .filter((record) => record.userId === userId)
    .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1));
};

export const saveHistory = async (userId: string, record: HistoryRecord) =>
  updateStore((store) => {
    const nextRecord: StoredHistory = {
      ...record,
      userId,
    };

    const filtered = store.history.filter((item) => !(item.userId === userId && item.id === record.id));
    const ownRecords = filtered.filter((item) => item.userId === userId);
    const otherRecords = filtered.filter((item) => item.userId !== userId);

    store.history = [nextRecord, ...ownRecords].slice(0, 60).concat(otherRecords);
    return nextRecord;
  });

export const deleteHistory = async (userId: string, recordId: string) =>
  updateStore((store) => {
    store.history = store.history.filter((item) => !(item.userId === userId && item.id === recordId));
  });

export const createSession = async (input: { tokenHash: string; userId: string; expiresAt: string }) =>
  updateStore((store) => {
    const session: StoredSession = {
      id: randomUUID(),
      tokenHash: input.tokenHash,
      userId: input.userId,
      createdAt: new Date().toISOString(),
      expiresAt: input.expiresAt,
    };

    store.sessions = store.sessions
      .filter((item) => item.userId !== input.userId && item.tokenHash !== input.tokenHash)
      .concat(session);

    return session;
  });

export const findSession = async (tokenHash: string) => {
  const store = await readStore();
  const now = Date.now();

  return (
    store.sessions.find(
      (session) => session.tokenHash === tokenHash && new Date(session.expiresAt).getTime() > now,
    ) || null
  );
};

export const deleteSession = async (tokenHash: string) =>
  updateStore((store) => {
    store.sessions = store.sessions.filter((item) => item.tokenHash !== tokenHash);
  });

export const pruneExpiredSessions = async () =>
  updateStore((store) => {
    const now = Date.now();
    store.sessions = store.sessions.filter((session) => new Date(session.expiresAt).getTime() > now);
  });
