"use client";

import {
  IconClockHour4,
  IconDownload,
  IconLogout,
  IconMoonStars,
  IconPhotoPlus,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconStar,
  IconStarFilled,
  IconSunHigh,
  IconTrash,
} from "@tabler/icons-react";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { buildUserSummary, isImagePayload } from "@/lib/skill-prompts";
import { skillCards, type SkillId } from "@/lib/site-data";
import {
  deleteHistoryRecord,
  getEmptyProfile,
  loadStudioState,
  saveHistoryRecord,
  saveUserProfile,
} from "@/lib/studio-storage";
import type {
  AssistantResult,
  AuthUser,
  HistoryRecord,
  LiveForm,
  StudioMessage,
  StudioPayload,
  StreamEvent,
  UploadAsset,
  UserProfile,
  VideoForm,
  VisualForm,
  XiaohongshuForm,
} from "@/lib/studio-types";

type UploadKind = "logo" | "reference";
type ThemeMode = "dark" | "light";

const visualDefaults: VisualForm = {
  designType: "产品头图",
  storeName: "",
  productName: "",
  price: "",
  benefits: "",
  themeColor: "",
  extraNotes: "",
  logoAssets: [],
  referenceAssets: [],
};

const videoDefaults: VideoForm = {
  route: "营销短视频",
  goal: "转化下单",
  productName: "",
  price: "",
  storeAdvantages: "",
  targetAudience: "",
  sourceNotes: "",
  extraNotes: "",
};

const liveDefaults: LiveForm = {
  mode: "生成模式",
  location: "",
  campaignTheme: "",
  storeAdvantages: "",
  offerContent: "",
  goal: "成交转化",
  targetAudience: "",
  currentScript: "",
  extraNotes: "",
};

const xhsNoteDefaults: XiaohongshuForm = {
  outputType: "小红书笔记",
  route: "探店种草笔记",
  goal: "种草进店",
  storeName: "",
  location: "",
  productName: "",
  price: "",
  benefits: "",
  storeHighlights: "",
  targetAudience: "",
  referenceStyle: "",
  themeColor: "",
  tone: "",
  hashtags: "",
  extraNotes: "",
  logoAssets: [],
  referenceAssets: [],
};

const xhsImageDefaults: XiaohongshuForm = {
  ...xhsNoteDefaults,
  outputType: "小红书笔记图",
};

const submitTexts: Record<SkillId, string> = {
  "chanping-toutu": "生成图片",
  "duanshipin-moban": "生成脚本",
  "zhibo-huashu": "生成话术",
  "xiaohongshu-biji": "生成笔记",
  "xiaohongshu-bijitu": "生成封面图",
};

const pendingTexts: Record<SkillId, string> = {
  "chanping-toutu": "正在整理门店信息并生成图片…",
  "duanshipin-moban": "正在生成短视频脚本并做自检…",
  "zhibo-huashu": "正在生成直播话术并做自检…",
  "xiaohongshu-biji": "正在生成小红书笔记并做自检…",
  "xiaohongshu-bijitu": "正在生成小红书封面图并做自检…",
};

const createId = () => globalThis.crypto?.randomUUID?.() || `skill-${Date.now()}-${Math.random()}`;

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const formatClockDate = (value: Date) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(value);

const formatClockTime = (value: Date) =>
  new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value);

const getSkillCard = (skillId: SkillId) => skillCards.find((card) => card.id === skillId) || skillCards[0];

const readFiles = async (files: FileList | null) => {
  if (!files?.length) {
    return [] as UploadAsset[];
  }

  const entries = Array.from(files).map(
    (file) =>
      new Promise<UploadAsset>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve({
            name: file.name,
            dataUrl: typeof reader.result === "string" ? reader.result : "",
            mediaType: file.type || "image/png",
          });
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      }),
  );

  return Promise.all(entries);
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const trimValue = (value: string) => value.trim();

const fieldValue = (text: string, labels: string[]) => {
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}[：:]?\\s*(.+)`, "i");
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
};

const listValue = (text: string, labels: string[]) => {
  const labeled = fieldValue(text, labels);
  if (labeled) {
    return labeled;
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const bullets = lines
    .filter((line) => /^\d+[.、]\s*/.test(line) || /^[-•]/.test(line))
    .map((line) => line.replace(/^\d+[.、]\s*|^[-•]\s*/, "").trim());

  return bullets.join(" ");
};

const inferVisualDesignType = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes("a3")) return "A3 KT板";
  if (lower.includes("a4")) return "A4 KT板";
  if (text.includes("团购头图")) return "团购头图";
  if (text.includes("套餐图")) return "套餐图";
  if (text.includes("私教周卡")) return "私教周卡";
  if (text.includes("健身月卡")) return "健身月卡";
  if (text.includes("门店宣传")) return "门店宣传图";
  return "产品头图";
};

const inferVideoRoute = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes("轻ip") || lower.includes("3km") || text.includes("大众熟人")) {
    return "种草短视频（官方轻IP / 3km大众熟人）";
  }
  if (text.includes("素人")) {
    return "种草短视频（素人氛围号）";
  }
  if (text.includes("核销")) {
    return "核销短视频";
  }
  if (text.includes("预热") || text.includes("引流") || text.includes("直播间")) {
    return "引流直播间短视频";
  }
  return "营销短视频";
};

const inferLiveMode = (text: string) => (text.includes("优化") || text.includes("改") ? "优化模式" : "生成模式");

const inferXhsRoute = (text: string) => {
  const lower = text.toLowerCase();
  if (text.includes("轻IP") || lower.includes("轻ip") || text.includes("主理人") || text.includes("教练")) {
    return "轻IP日常笔记";
  }
  if (text.includes("干货") || text.includes("清单") || text.includes("避坑") || text.includes("入门")) {
    return "干货清单笔记";
  }
  if (text.includes("团购") || text.includes("转化") || text.includes("月卡")) {
    return "团购转化笔记";
  }
  return "探店种草笔记";
};

const mergeWithFallback = (value: string, fallback: string) => trimValue(value) || trimValue(fallback);

const joinNotes = (...values: string[]) =>
  values
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");

const mergePayloadWithProfile = (payload: StudioPayload, profile: UserProfile): StudioPayload => {
  switch (payload.skill) {
    case "chanping-toutu":
      return {
        ...payload,
        form: {
          ...payload.form,
          storeName: mergeWithFallback(payload.form.storeName, profile.storeName),
          price: mergeWithFallback(payload.form.price, profile.mainOfferPrice),
          benefits: mergeWithFallback(payload.form.benefits, profile.mainOfferContent),
          themeColor: mergeWithFallback(payload.form.themeColor, profile.themeColor),
          logoAssets: payload.form.logoAssets.length ? payload.form.logoAssets : profile.logoAssets,
        },
      };
    case "duanshipin-moban":
      return {
        ...payload,
        form: {
          ...payload.form,
          price: mergeWithFallback(payload.form.price, profile.mainOfferPrice),
          storeAdvantages: mergeWithFallback(payload.form.storeAdvantages, profile.storeHighlights),
          extraNotes: joinNotes(
            payload.form.extraNotes,
            profile.mainOfferContent ? `主推团单内容：${profile.mainOfferContent}` : "",
          ),
        },
      };
    case "zhibo-huashu":
      return {
        ...payload,
        form: {
          ...payload.form,
          location: mergeWithFallback(payload.form.location, profile.location),
          storeAdvantages: mergeWithFallback(payload.form.storeAdvantages, profile.storeHighlights),
          offerContent: mergeWithFallback(payload.form.offerContent, profile.mainOfferContent),
          extraNotes: joinNotes(
            payload.form.extraNotes,
            profile.redemptionGift7d ? `7天核销有礼：${profile.redemptionGift7d}` : "",
          ),
        },
      };
    case "xiaohongshu-biji":
    case "xiaohongshu-bijitu":
      return {
        ...payload,
        form: {
          ...payload.form,
          storeName: mergeWithFallback(payload.form.storeName, profile.storeName),
          location: mergeWithFallback(payload.form.location, profile.location),
          price: mergeWithFallback(payload.form.price, profile.mainOfferPrice),
          benefits: mergeWithFallback(payload.form.benefits, profile.mainOfferContent),
          storeHighlights: mergeWithFallback(payload.form.storeHighlights, profile.storeHighlights),
          themeColor: mergeWithFallback(payload.form.themeColor, profile.themeColor),
          logoAssets: payload.form.logoAssets.length ? payload.form.logoAssets : profile.logoAssets,
        },
      };
  }
};

const parseQuickPayload = (
  skill: SkillId,
  prompt: string,
  forms: {
    visualForm: VisualForm;
    videoForm: VideoForm;
    liveForm: LiveForm;
    xhsNoteForm: XiaohongshuForm;
    xhsImageForm: XiaohongshuForm;
  },
): StudioPayload => {
  const text = prompt.trim();

  switch (skill) {
    case "chanping-toutu":
      return {
        skill,
        form: {
          ...forms.visualForm,
          designType: inferVisualDesignType(text),
          storeName: fieldValue(text, ["门店名称", "门店名", "店名"]),
          productName: fieldValue(text, ["产品名称", "产品名", "套餐名", "标题"]),
          price: fieldValue(text, ["价格", "活动价", "售价"]),
          benefits: listValue(text, ["产品信息", "产品权益", "权益", "卖点"]),
          themeColor: fieldValue(text, ["主题色", "主色", "颜色"]),
          extraNotes: text,
        },
      };
    case "duanshipin-moban":
      return {
        skill,
        form: {
          ...forms.videoForm,
          route: inferVideoRoute(text),
          goal: fieldValue(text, ["视频目标", "目标"]) || forms.videoForm.goal,
          productName: fieldValue(text, ["产品名称", "产品名", "主题"]),
          price: fieldValue(text, ["价格", "活动价", "售价"]),
          storeAdvantages: listValue(text, ["门店优势", "门店卖点", "卖点"]),
          targetAudience: fieldValue(text, ["目标人群", "适合人群", "用户"]),
          sourceNotes: fieldValue(text, ["参考资料", "参考账号", "来源"]),
          extraNotes: text,
        },
      };
    case "zhibo-huashu":
      return {
        skill,
        form: {
          ...forms.liveForm,
          mode: inferLiveMode(text),
          location: fieldValue(text, ["门店位置", "位置"]),
          campaignTheme: fieldValue(text, ["活动主题", "主题"]),
          storeAdvantages: listValue(text, ["门店优势", "门店卖点", "卖点"]),
          offerContent: listValue(text, ["团单内容", "团单", "活动内容"]),
          goal: fieldValue(text, ["直播目标", "目标"]) || forms.liveForm.goal,
          targetAudience: fieldValue(text, ["目标人群", "适合人群"]),
          currentScript: fieldValue(text, ["已有话术", "当前话术"]),
          extraNotes: text,
        },
      };
    case "xiaohongshu-biji":
      return {
        skill,
        form: {
          ...forms.xhsNoteForm,
          outputType: "小红书笔记",
          route: inferXhsRoute(text),
          goal: fieldValue(text, ["笔记目的", "目标", "目的"]) || forms.xhsNoteForm.goal,
          storeName: fieldValue(text, ["门店名称", "门店名", "店名"]),
          location: fieldValue(text, ["门店位置", "位置"]),
          productName: fieldValue(text, ["产品名称", "产品名", "主题"]),
          price: fieldValue(text, ["价格", "活动价", "售价"]),
          benefits: listValue(text, ["产品信息", "权益", "卖点"]),
          storeHighlights: listValue(text, ["门店优势", "门店卖点", "卖点"]),
          targetAudience: fieldValue(text, ["目标人群", "适合人群"]),
          referenceStyle: fieldValue(text, ["参考风格", "参考链接"]),
          themeColor: fieldValue(text, ["主题色", "主色", "颜色"]),
          tone: fieldValue(text, ["语气", "口吻"]),
          hashtags: fieldValue(text, ["标签", "话题词"]),
          extraNotes: text,
        },
      };
    case "xiaohongshu-bijitu":
      return {
        skill,
        form: {
          ...forms.xhsImageForm,
          outputType: "小红书笔记图",
          route: inferXhsRoute(text),
          goal: fieldValue(text, ["笔记目的", "目标", "目的"]) || forms.xhsImageForm.goal,
          storeName: fieldValue(text, ["门店名称", "门店名", "店名"]),
          location: fieldValue(text, ["门店位置", "位置"]),
          productName: fieldValue(text, ["产品名称", "产品名", "主题"]),
          price: fieldValue(text, ["价格", "活动价", "售价"]),
          benefits: listValue(text, ["产品信息", "权益", "卖点"]),
          storeHighlights: listValue(text, ["门店优势", "门店卖点", "卖点"]),
          targetAudience: fieldValue(text, ["目标人群", "适合人群"]),
          referenceStyle: fieldValue(text, ["参考风格", "参考链接"]),
          themeColor: fieldValue(text, ["主题色", "主色", "颜色"]),
          tone: fieldValue(text, ["语气", "口吻"]),
          hashtags: fieldValue(text, ["标签", "话题词"]),
          extraNotes: text,
        },
      };
  }
};

const getHistoryTitle = (payload: StudioPayload) => {
  switch (payload.skill) {
    case "chanping-toutu":
      return `${payload.form.designType} · ${payload.form.productName || payload.form.storeName || "未命名"}`;
    case "duanshipin-moban":
      return `${payload.form.route} · ${payload.form.productName || "短视频脚本"}`;
    case "zhibo-huashu":
      return `${payload.form.campaignTheme || "直播话术"} · ${payload.form.location || "门店直播"}`;
    case "xiaohongshu-biji":
      return `${payload.form.route} · ${payload.form.productName || "小红书笔记"}`;
    case "xiaohongshu-bijitu":
      return `小红书封面 · ${payload.form.productName || payload.form.storeName || "未命名"}`;
  }
};

const getHistorySummary = (payload: StudioPayload, result: AssistantResult) => {
  if (result.meta?.coverCopy) {
    return result.meta.coverCopy;
  }

  const preview = result.text.replace(/\s+/g, " ").slice(0, 80).trim();
  return preview || getHistoryTitle(payload);
};

const buildChatSummary = (payload: StudioPayload, prompt: string) => {
  const lines = prompt.trim() ? [prompt.trim()] : [buildUserSummary(payload)];

  if (payload.skill === "chanping-toutu" || payload.skill === "xiaohongshu-bijitu") {
    if (payload.form.logoAssets.length) {
      lines.push(`已附 Logo ${payload.form.logoAssets.length} 张`);
    }
    if (payload.form.referenceAssets.length) {
      lines.push(`已附参考图 ${payload.form.referenceAssets.length} 张`);
    }
  }

  return lines.filter(Boolean).join("\n");
};

const getErrorText = (error: unknown) => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "这次生成超时了，你可以直接再发一次。";
  }

  if (error instanceof Error) {
    if (error.message.toLowerCase().includes("unauthorized")) {
      return "登录状态失效了，请重新登录。";
    }

    if (error.message.trim()) {
      return error.message.trim();
    }
  }

  return "这次没有顺利生成出来，你可以精简一下需求再试。";
};

const isImageSkill = (skillId: SkillId) => skillId === "chanping-toutu" || skillId === "xiaohongshu-bijitu";

const getAttachments = (skillId: SkillId, visualForm: VisualForm, xhsImageForm: XiaohongshuForm) => {
  if (skillId === "chanping-toutu") {
    return {
      logoAssets: visualForm.logoAssets,
      referenceAssets: visualForm.referenceAssets,
    };
  }

  if (skillId === "xiaohongshu-bijitu") {
    return {
      logoAssets: xhsImageForm.logoAssets,
      referenceAssets: xhsImageForm.referenceAssets,
    };
  }

  return {
    logoAssets: [] as UploadAsset[],
    referenceAssets: [] as UploadAsset[],
  };
};

const assetLabel = (asset: UploadAsset) => {
  const name = asset.name.trim();
  return name.length > 18 ? `${name.slice(0, 18)}…` : name;
};

const MetaSummary = ({ message }: { message: StudioMessage }) => {
  const meta = message.meta;
  if (!meta) {
    return null;
  }

  return (
    <div className="result-meta">
      {meta.route ? <span className="inline-chip strong">{meta.route}</span> : null}
      {meta.reviewSummary ? <span className="inline-chip">{meta.reviewSummary}</span> : null}
      {meta.coverCopy ? <span className="inline-chip strong">{meta.coverCopy}</span> : null}
      {meta.titles?.slice(0, 3).map((title) => (
        <span key={title} className="inline-chip">
          {title}
        </span>
      ))}
      {meta.hashtags?.slice(0, 6).map((tag) => (
        <span key={tag} className="inline-chip">
          {tag}
        </span>
      ))}
    </div>
  );
};

const MessageCard = ({ message }: { message: StudioMessage }) => {
  const card = getSkillCard(message.skillId);
  const isUser = message.role === "user";
  const downloadName = `${message.title || card.title}.png`;

  return (
    <article className={`message-card ${isUser ? "user" : "assistant"}`}>
      <div className="message-head">
        <span className="message-skill">{card.title}</span>
        <time>{formatTime(message.createdAt)}</time>
      </div>

      {message.note ? <p className="message-note">{message.note}</p> : null}

      {message.imageDataUrl ? (
        <div className="image-result">
          <img src={message.imageDataUrl} alt={message.title || card.title} />
          <a className="download-link" href={message.imageDataUrl} download={downloadName}>
            <IconDownload size={16} />
            下载图片
          </a>
        </div>
      ) : null}

      {message.content ? <p className={`message-text ${isUser ? "user-text" : ""}`}>{message.content}</p> : null}

      {message.meta ? <MetaSummary message={message} /> : null}

      {message.actions?.length ? (
        <div className="action-row">
          {message.actions.map((action) => (
            <span key={action} className="inline-chip">
              {action}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
};

const SettingsDrawer = ({
  open,
  profile,
  username,
  saving,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  profile: UserProfile;
  username: string;
  saving: boolean;
  onClose: () => void;
  onChange: (profile: UserProfile) => void;
  onSave: () => void;
}) => {
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) {
    return null;
  }

  const update = (key: keyof UserProfile, value: string | UploadAsset[]) => {
    onChange({
      ...profile,
      [key]: value,
    });
  };

  const handleLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const assets = await readFiles(event.target.files);
    update("logoAssets", assets.slice(0, 1));
    event.target.value = "";
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <section className="drawer-panel" onClick={(event) => event.stopPropagation()}>
        <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={handleLogoChange} />

        <div className="drawer-head">
          <span className="drawer-kicker">Settings</span>
          <h3>门店信息</h3>
          <p>当前账号：{username}</p>
        </div>

        <div className="settings-grid">
          <label className="settings-field">
            <span>门店名称</span>
            <input value={profile.storeName} onChange={(event) => update("storeName", event.target.value)} />
          </label>

          <label className="settings-field">
            <span>门店位置</span>
            <input value={profile.location} onChange={(event) => update("location", event.target.value)} />
          </label>

          <label className="settings-field span-2">
            <span>门店优势（卖点）</span>
            <textarea
              value={profile.storeHighlights}
              onChange={(event) => update("storeHighlights", event.target.value)}
              placeholder="比如：1000平场地、百台进口器械、免费淋浴、免费停车、巡场教练、体测"
            />
          </label>

          <label className="settings-field">
            <span>主推团单价格</span>
            <input
              value={profile.mainOfferPrice}
              onChange={(event) => update("mainOfferPrice", event.target.value)}
              placeholder="比如：99元健身月卡"
            />
          </label>

          <label className="settings-field">
            <span>门店主题色</span>
            <input
              value={profile.themeColor}
              onChange={(event) => update("themeColor", event.target.value)}
              placeholder="比如：薄荷青 / 宝蓝 / #63d6ce"
            />
          </label>

          <label className="settings-field span-2">
            <span>主推团单内容</span>
            <textarea
              value={profile.mainOfferContent}
              onChange={(event) => update("mainOfferContent", event.target.value)}
              placeholder="比如：价值259元健身月卡一张、免费淋浴、免费停车、巡场教练、体测"
            />
          </label>

          <label className="settings-field">
            <span>门店 Logo 图</span>
            <button type="button" className="secondary-chip settings-upload" onClick={() => logoInputRef.current?.click()}>
              <IconPhotoPlus size={16} />
              上传 Logo
            </button>
            {profile.logoAssets.length ? (
              <div className="upload-row">
                {profile.logoAssets.map((asset, index) => (
                  <button
                    key={`${asset.name}-${index}`}
                    type="button"
                    className="asset-chip"
                    onClick={() => update("logoAssets", profile.logoAssets.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    {assetLabel(asset)}
                  </button>
                ))}
              </div>
            ) : (
              <span className="settings-note">未上传时，图片技能会优先按当前任务生成。</span>
            )}
          </label>

          <label className="settings-field">
            <span>7天核销有礼</span>
            <input
              value={profile.redemptionGift7d}
              onChange={(event) => update("redemptionGift7d", event.target.value)}
              placeholder="比如：7天内核销送小礼品"
            />
          </label>
        </div>

        <div className="drawer-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary-button" onClick={onSave} disabled={saving}>
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </section>
    </div>
  );
};

export function SkillStudio({ currentUser }: { currentUser: AuthUser }) {
  const [activeSkill, setActiveSkill] = useState<SkillId>("chanping-toutu");
  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const [search, setSearch] = useState("");
  const [quickInput, setQuickInput] = useState("");
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [profile, setProfile] = useState<UserProfile>(getEmptyProfile());
  const [visualForm, setVisualForm] = useState<VisualForm>(visualDefaults);
  const [videoForm, setVideoForm] = useState<VideoForm>(videoDefaults);
  const [liveForm, setLiveForm] = useState<LiveForm>(liveDefaults);
  const [xhsNoteForm, setXhsNoteForm] = useState<XiaohongshuForm>(xhsNoteDefaults);
  const [xhsImageForm, setXhsImageForm] = useState<XiaohongshuForm>(xhsImageDefaults);

  const threadRef = useRef<HTMLDivElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);
  const shouldStickRef = useRef(true);
  const searchQuery = useDeferredValue(search.trim().toLowerCase());
  const activeCard = getSkillCard(activeSkill);
  const activeAttachments = getAttachments(activeSkill, visualForm, xhsImageForm);

  const filteredHistory = useMemo(() => {
    const sorted = [...historyRecords].sort((left, right) => {
      if (left.starred !== right.starred) {
        return left.starred ? -1 : 1;
      }

      return left.updatedAt < right.updatedAt ? 1 : -1;
    });

    if (!searchQuery) {
      return sorted;
    }

    return sorted.filter((record) => {
      const skillName = getSkillCard(record.skillId).title.toLowerCase();
      if (skillName.includes(searchQuery)) {
        return true;
      }

      const text = `${record.title} ${record.summary}`.toLowerCase();
      return text.includes(searchQuery);
    });
  }, [historyRecords, searchQuery]);

  useEffect(() => {
    const nextTheme =
      window.localStorage.getItem("skill-studio-theme") === "light"
        ? "light"
        : window.localStorage.getItem("skill-studio-theme") === "dark"
          ? "dark"
          : window.matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark";
    setTheme(nextTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("skill-studio-theme", theme);
  }, [theme]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadStudioState()
      .then((state) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setHistoryRecords(state.history);
          setProfile(state.profile);
        });
      })
      .catch(() => {
        if (!cancelled) {
          window.location.href = "/login";
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInitializing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!shouldStickRef.current) {
      return;
    }

    const node = threadRef.current;
    if (!node) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, loading, error]);

  const buildDraftPayload = () =>
    parseQuickPayload(activeSkill, quickInput, {
      visualForm,
      videoForm,
      liveForm,
      xhsNoteForm,
      xhsImageForm,
    });

  const resetActiveDraft = (skillId: SkillId) => {
    switch (skillId) {
      case "chanping-toutu":
        setVisualForm(visualDefaults);
        return;
      case "duanshipin-moban":
        setVideoForm(videoDefaults);
        return;
      case "zhibo-huashu":
        setLiveForm(liveDefaults);
        return;
      case "xiaohongshu-biji":
        setXhsNoteForm(xhsNoteDefaults);
        return;
      case "xiaohongshu-bijitu":
        setXhsImageForm(xhsImageDefaults);
    }
  };

  const updateAssistantMessage = (messageId: string, patch: Partial<StudioMessage>) => {
    setMessages((prev) => prev.map((message) => (message.id === messageId ? { ...message, ...patch } : message)));
  };

  const persistRecord = async (payload: StudioPayload, userMessage: StudioMessage, result: AssistantResult) => {
    const assistantMessage: StudioMessage = {
      id: createId(),
      role: "assistant",
      skillId: payload.skill,
      title: submitTexts[payload.skill],
      content: result.text,
      createdAt: new Date().toISOString(),
      note: result.note,
      actions: result.actions,
      imageDataUrl: result.imageDataUrl,
      resultType: result.type,
      meta: result.meta,
    };

    const existing = historyRecords.find((item) => item.id === selectedHistoryId);
    const record: HistoryRecord = {
      id: selectedHistoryId || createId(),
      skillId: payload.skill,
      title: getHistoryTitle(payload),
      summary: getHistorySummary(payload, result),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      starred: existing?.starred || false,
      resultType: result.type,
      messages: [userMessage, assistantMessage],
      meta: result.meta,
    };

    await saveHistoryRecord(record);
    setHistoryRecords((prev) => [record, ...prev.filter((item) => item.id !== record.id)].slice(0, 60));
    setSelectedHistoryId(record.id);
  };

  const submit = async () => {
    if (loading) {
      return;
    }

    if (!quickInput.trim() && !activeAttachments.logoAssets.length && !activeAttachments.referenceAssets.length) {
      setError("先在输入框里说清楚需求，或者先上传 Logo / 参考图。");
      return;
    }

    const payload = mergePayloadWithProfile(buildDraftPayload(), profile);
    const userMessage: StudioMessage = {
      id: createId(),
      role: "user",
      skillId: payload.skill,
      title: getHistoryTitle(payload),
      content: buildChatSummary(payload, quickInput),
      createdAt: new Date().toISOString(),
    };

    const assistantId = createId();
    const assistantPlaceholder: StudioMessage = {
      id: assistantId,
      role: "assistant",
      skillId: payload.skill,
      title: submitTexts[payload.skill],
      content: "",
      note: pendingTexts[payload.skill],
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setQuickInput("");
    setError("");
    setLoading(true);
    shouldStickRef.current = true;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), isImagePayload(payload) ? 420_000 : 240_000);

    try {
      if (!isImagePayload(payload)) {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-stream-text": "1",
          },
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify(payload),
        });

        if (response.status === 401) {
          throw new Error("unauthorized");
        }

        if (!response.ok || !response.body) {
          throw new Error("text generation failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalResult: AssistantResult | null = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          let breakIndex = buffer.indexOf("\n");

          while (breakIndex >= 0) {
            const line = buffer.slice(0, breakIndex).trim();
            buffer = buffer.slice(breakIndex + 1);

            if (line) {
              const event = JSON.parse(line) as StreamEvent;

              if (event.type === "status") {
                updateAssistantMessage(assistantId, { note: event.message });
              }

              if (event.type === "chunk") {
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === assistantId ? { ...message, content: `${message.content}${event.text}` } : message,
                  ),
                );
              }

              if (event.type === "result") {
                finalResult = event.data;
                updateAssistantMessage(assistantId, {
                  content: event.data.text,
                  note: event.data.note,
                  actions: event.data.actions,
                  imageDataUrl: event.data.imageDataUrl,
                  resultType: event.data.type,
                  meta: event.data.meta,
                });
              }

              if (event.type === "error") {
                throw new Error(event.error);
              }
            }

            breakIndex = buffer.indexOf("\n");
          }
        }

        if (finalResult) {
          await persistRecord(payload, userMessage, finalResult);
        }
      } else {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify(payload),
        });

        if (response.status === 401) {
          throw new Error("unauthorized");
        }

        const result = (await response.json()) as AssistantResult & { error?: string; note?: string };
        if (!response.ok) {
          throw new Error(result.note || result.error || "image generation failed");
        }

        updateAssistantMessage(assistantId, {
          content: result.text,
          note: result.note,
          actions: result.actions,
          imageDataUrl: result.imageDataUrl,
          resultType: result.type,
          meta: result.meta,
        });

        await persistRecord(payload, userMessage, result);
      }
    } catch (submitError) {
      const nextError = getErrorText(submitError);
      setError(nextError);
      updateAssistantMessage(assistantId, {
        note: nextError,
        content: "",
      });
      if (nextError.includes("重新登录")) {
        window.setTimeout(() => {
          window.location.href = "/login";
        }, 500);
      }
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setSelectedHistoryId("");
    setQuickInput("");
    setError("");
    resetActiveDraft(activeSkill);
  };

  const selectSkill = (skillId: SkillId) => {
    if (skillId === activeSkill) {
      return;
    }

    setActiveSkill(skillId);
    setMessages([]);
    setSelectedHistoryId("");
    setQuickInput("");
    setError("");
    resetActiveDraft(skillId);
  };

  const openHistory = (record: HistoryRecord) => {
    setActiveSkill(record.skillId);
    setSelectedHistoryId(record.id);
    setMessages(record.messages);
    setQuickInput("");
    setError("");
  };

  const toggleStar = async (recordId: string) => {
    const record = historyRecords.find((item) => item.id === recordId);
    if (!record) {
      return;
    }

    const nextRecord = {
      ...record,
      starred: !record.starred,
      updatedAt: new Date().toISOString(),
    };

    await saveHistoryRecord(nextRecord);
    setHistoryRecords((prev) => [nextRecord, ...prev.filter((item) => item.id !== recordId)]);
  };

  const removeHistory = async (recordId: string) => {
    await deleteHistoryRecord(recordId);
    setHistoryRecords((prev) => prev.filter((item) => item.id !== recordId));

    if (selectedHistoryId === recordId) {
      setMessages([]);
      setSelectedHistoryId("");
    }
  };

  const openUpload = (kind: UploadKind) => {
    if (kind === "logo") {
      logoInputRef.current?.click();
      return;
    }

    referenceInputRef.current?.click();
  };

  const setAssets = (kind: UploadKind, assets: UploadAsset[]) => {
    if (activeSkill === "chanping-toutu") {
      setVisualForm((prev) => ({
        ...prev,
        logoAssets: kind === "logo" ? assets : prev.logoAssets,
        referenceAssets: kind === "reference" ? assets : prev.referenceAssets,
      }));
      return;
    }

    if (activeSkill === "xiaohongshu-bijitu") {
      setXhsImageForm((prev) => ({
        ...prev,
        logoAssets: kind === "logo" ? assets : prev.logoAssets,
        referenceAssets: kind === "reference" ? assets : prev.referenceAssets,
      }));
    }
  };

  const removeAsset = (kind: UploadKind, index: number) => {
    if (activeSkill === "chanping-toutu") {
      setVisualForm((prev) => ({
        ...prev,
        logoAssets: kind === "logo" ? prev.logoAssets.filter((_, itemIndex) => itemIndex !== index) : prev.logoAssets,
        referenceAssets:
          kind === "reference"
            ? prev.referenceAssets.filter((_, itemIndex) => itemIndex !== index)
            : prev.referenceAssets,
      }));
      return;
    }

    if (activeSkill === "xiaohongshu-bijitu") {
      setXhsImageForm((prev) => ({
        ...prev,
        logoAssets: kind === "logo" ? prev.logoAssets.filter((_, itemIndex) => itemIndex !== index) : prev.logoAssets,
        referenceAssets:
          kind === "reference"
            ? prev.referenceAssets.filter((_, itemIndex) => itemIndex !== index)
            : prev.referenceAssets,
      }));
    }
  };

  const handleLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const assets = await readFiles(event.target.files);
    setAssets("logo", assets);
    event.target.value = "";
  };

  const handleReferenceChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const assets = await readFiles(event.target.files);
    setAssets("reference", assets);
    event.target.value = "";
  };

  const handleThreadScroll = () => {
    const node = threadRef.current;
    if (!node) {
      return;
    }

    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    shouldStickRef.current = distanceFromBottom < 120;
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);

    try {
      await saveUserProfile(profile);
      setSettingsOpen(false);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    window.location.href = "/login";
  };

  if (initializing) {
    return (
      <main className="studio-root">
        <div className="loading-shell">正在进入工作台…</div>
      </main>
    );
  }

  return (
    <main className="studio-root">
      <div className="studio-glow" aria-hidden="true" />

      <input ref={logoInputRef} type="file" accept="image/*" multiple hidden onChange={handleLogoChange} />
      <input
        ref={referenceInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleReferenceChange}
      />

      <section className="studio-layout">
        <aside className="left-rail">
          <div className="rail-brand">
            <h1>亿达商学</h1>
          </div>

          <div className="rail-actions">
            <button type="button" className="rail-button strong" onClick={startNewChat}>
              新对话
            </button>

            <label className="search-box">
              <IconSearch size={16} stroke={1.9} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索记忆" />
            </label>
          </div>

          <div className="memory-block">
            <div className="memory-head">
              <span>记忆</span>
              <span>{filteredHistory.length}</span>
            </div>

            <div className="memory-list">
              {filteredHistory.length ? (
                filteredHistory.map((record) => {
                  const card = getSkillCard(record.skillId);
                  return (
                    <div key={record.id} className={`memory-item${selectedHistoryId === record.id ? " active" : ""}`}>
                      <button type="button" className="memory-open" onClick={() => openHistory(record)}>
                        <div className="memory-meta">
                          <span className="memory-tag">{card.title}</span>
                          <time>{formatTime(record.updatedAt)}</time>
                        </div>
                        <strong>{record.title}</strong>
                        <p>{record.summary}</p>
                      </button>

                      <div className="memory-actions">
                        <button type="button" className="icon-button" onClick={() => void toggleStar(record.id)}>
                          {record.starred ? <IconStarFilled size={16} /> : <IconStar size={16} />}
                        </button>
                        <button type="button" className="icon-button" onClick={() => void removeHistory(record.id)}>
                          <IconTrash size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="memory-empty">还没有内容，生成后会在这里保留。</div>
              )}
            </div>
          </div>

          <div className="rail-footer">
            <button type="button" className="footer-button" onClick={() => setSettingsOpen(true)}>
              <IconSettings size={16} />
              设置
            </button>
            <button type="button" className="footer-button" onClick={() => void handleLogout()}>
              <IconLogout size={16} />
              退出
            </button>
          </div>
        </aside>

        <section className="workspace">
          <div className="workspace-topbar">
            <div className="skill-row">
              {skillCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={`skill-pill${card.id === activeSkill ? " active" : ""}`}
                  onClick={() => selectSkill(card.id)}
                >
                  <span>{card.index}</span>
                  <strong>{card.title}</strong>
                  <small>{card.subtitle}</small>
                </button>
              ))}
            </div>

            <div className="workspace-tools">
              <div className="clock-pill">
                <IconClockHour4 size={16} />
                <div>
                  <strong>{formatClockTime(now)}</strong>
                  <span>{formatClockDate(now)}</span>
                </div>
              </div>

              <button
                type="button"
                className="theme-toggle"
                onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              >
                {theme === "dark" ? <IconSunHigh size={16} /> : <IconMoonStars size={16} />}
                {theme === "dark" ? "亮色" : "暗色"}
              </button>
            </div>
          </div>

          <div className="thread-panel" ref={threadRef} onScroll={handleThreadScroll}>
            {messages.length ? (
              <>
                {error ? <div className="status-banner danger">{error}</div> : null}
                {messages.map((message) => (
                  <MessageCard key={message.id} message={message} />
                ))}
              </>
            ) : (
              <div className="thread-empty">
                <span className="empty-badge">{activeCard.title}</span>
                <strong>{activeCard.title}</strong>
                <p>{activeCard.subtitle}</p>
              </div>
            )}
          </div>

          <div className="composer-panel">
            <div className="composer-head">
              <div className="composer-skill">
                <IconSparkles size={16} />
                <span>{activeCard.title}</span>
              </div>

              <button type="button" className="memory-settings" onClick={() => setSettingsOpen(true)}>
                门店信息
              </button>
            </div>

            {isImageSkill(activeSkill) ? (
              <div className="upload-row">
                <button type="button" className="secondary-chip" onClick={() => openUpload("logo")}>
                  <IconPhotoPlus size={16} />
                  上传 Logo
                </button>
                <button type="button" className="secondary-chip" onClick={() => openUpload("reference")}>
                  <IconPhotoPlus size={16} />
                  上传参考图
                </button>

                {activeAttachments.logoAssets.map((asset, index) => (
                  <button
                    key={`logo-${asset.name}-${index}`}
                    type="button"
                    className="asset-chip"
                    onClick={() => removeAsset("logo", index)}
                  >
                    Logo · {assetLabel(asset)}
                  </button>
                ))}

                {activeAttachments.referenceAssets.map((asset, index) => (
                  <button
                    key={`reference-${asset.name}-${index}`}
                    type="button"
                    className="asset-chip"
                    onClick={() => removeAsset("reference", index)}
                  >
                    参考图 · {assetLabel(asset)}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="composer-box">
              <textarea
                value={quickInput}
                onChange={(event) => setQuickInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeCard.placeholder}
              />
            </div>

            <div className="composer-foot">
              <span>回车发送，Shift + 回车换行</span>
              <button type="button" className="primary-button" onClick={() => void submit()} disabled={loading}>
                {loading ? "生成中..." : submitTexts[activeSkill]}
              </button>
            </div>
          </div>
        </section>
      </section>

      <SettingsDrawer
        open={settingsOpen}
        profile={profile}
        username={currentUser.username}
        saving={savingProfile}
        onClose={() => setSettingsOpen(false)}
        onChange={setProfile}
        onSave={() => void handleSaveProfile()}
      />
    </main>
  );
}
