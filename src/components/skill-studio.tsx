"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { skillCards, type SkillId } from "@/lib/site-data";
import { buildUserSummary, isImagePayload } from "@/lib/skill-prompts";
import {
  deleteHistoryRecord,
  loadHistoryRecords,
  loadUserProfile,
  saveHistoryRecord,
  saveUserProfile,
  type HistoryRecord,
  type UserProfile,
} from "@/lib/studio-storage";
import type {
  AssistantResult,
  LiveForm,
  StudioMessage,
  StudioPayload,
  StreamEvent,
  UploadAsset,
  VideoForm,
  VisualForm,
  XiaohongshuForm,
} from "@/lib/studio-types";

type SurfaceMeta = {
  scope: string;
  submitText: string;
  pendingText: string;
  emptyText: string;
};

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

const xhsDefaults: XiaohongshuForm = {
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

const designOptions = ["产品头图", "团购头图", "套餐图", "A4 KT板", "A3 KT板", "健身月卡", "私教周卡", "门店宣传图"];

const videoRoutes = ["营销短视频", "官方轻IP（3km大众熟人）", "素人氛围号", "预热视频 / 核销视频 / 引流视频"];

const liveModes = ["生成模式", "优化模式"];
const xhsOutputs: XiaohongshuForm["outputType"][] = ["小红书笔记", "小红书笔记图"];
const xhsRoutes = ["团购转化笔记", "探店种草笔记", "轻IP日常笔记", "干货清单笔记"];

const surfaceMeta: Record<SkillId, SurfaceMeta> = {
  "chanping-toutu": {
    scope: "Logo / 产品 / 主题色",
    submitText: "生成图片",
    pendingText: "正在整理设计参数并生成图片",
    emptyText: "填好门店和产品信息后，这里会像聊天一样展示生成过程和结果。",
  },
  "duanshipin-moban": {
    scope: "路线 / 卖点 / 人群",
    submitText: "生成脚本",
    pendingText: "正在生成并复核短视频脚本",
    emptyText: "脚本会在这里逐步展开，适合直接拿去拍摄。",
  },
  "zhibo-huashu": {
    scope: "位置 / 团单 / 成交流程",
    submitText: "生成话术",
    pendingText: "正在生成并复核直播话术",
    emptyText: "这里会输出直播成稿，也会保留最近生成的历史记录。",
  },
  "xiaohongshu-biji": {
    scope: "笔记 / 封面 / 种草路线",
    submitText: "生成内容",
    pendingText: "正在生成并复核小红书内容",
    emptyText: "这里会展示笔记正文或封面图结果，并自动进入历史库。",
  },
};

const readFiles = async (files: FileList | null) => {
  if (!files?.length) {
    return [];
  }

  const entries = Array.from(files).map(
    (file) =>
      new Promise<UploadAsset>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            name: file.name,
            dataUrl: typeof reader.result === "string" ? reader.result : "",
            mediaType: file.type || "image/png",
          });
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      }),
  );

  return Promise.all(entries);
};

const createId = () => globalThis.crypto?.randomUUID?.() || `skill-${Date.now()}-${Math.random()}`;

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const getErrorText = (error: unknown) => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "生成超时，请稍后重试。";
  }

  if (error instanceof Error) {
    return error.message || "生成失败，请稍后重试。";
  }

  return "生成失败，请稍后重试。";
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
      return payload.form.outputType === "小红书笔记图"
        ? `小红书封面 · ${payload.form.productName || payload.form.storeName || "未命名"}`
        : `${payload.form.route} · ${payload.form.productName || "小红书笔记"}`;
    default:
      return "未命名内容";
  }
};

const getHistorySummary = (payload: StudioPayload, result: AssistantResult) => {
  if (payload.skill === "xiaohongshu-biji" && result.meta?.coverCopy) {
    return result.meta.coverCopy;
  }

  const preview = result.text.replace(/\s+/g, " ").slice(0, 72).trim();
  return preview || "已生成内容";
};

const applyProfileDefaults = (
  profile: UserProfile,
  setVisualForm: React.Dispatch<React.SetStateAction<VisualForm>>,
  setVideoForm: React.Dispatch<React.SetStateAction<VideoForm>>,
  setLiveForm: React.Dispatch<React.SetStateAction<LiveForm>>,
  setXhsForm: React.Dispatch<React.SetStateAction<XiaohongshuForm>>,
) => {
  setVisualForm((prev) => ({
    ...prev,
    storeName: prev.storeName || profile.storeName,
    themeColor: prev.themeColor || profile.themeColor,
  }));

  setVideoForm((prev) => ({
    ...prev,
    targetAudience: prev.targetAudience || profile.defaultAudience,
    extraNotes: prev.extraNotes || profile.storeTags,
  }));

  setLiveForm((prev) => ({
    ...prev,
    location: prev.location || profile.location,
    targetAudience: prev.targetAudience || profile.defaultAudience,
  }));

  setXhsForm((prev) => ({
    ...prev,
    storeName: prev.storeName || profile.storeName,
    location: prev.location || profile.location,
    themeColor: prev.themeColor || profile.themeColor,
    tone: prev.tone || profile.noteTone,
    targetAudience: prev.targetAudience || profile.defaultAudience,
    referenceStyle: prev.referenceStyle || profile.coverStyle,
    hashtags: prev.hashtags || profile.topicWords,
  }));
};

const Field = ({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) => (
  <div className={`field-card${className ? ` ${className}` : ""}`}>
    <span className="field-label">{label}</span>
    {children}
    {hint ? <span className="field-hint">{hint}</span> : null}
  </div>
);

const ChoiceField = ({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
}) => (
  <Field label={label} className={className}>
    <div className="choice-wrap">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={`choice-pill${value === option ? " active" : ""}`}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  </Field>
);

const UploadSummary = ({
  assets,
  emptyLabel,
}: {
  assets: UploadAsset[];
  emptyLabel: string;
}) => (
  <div className="file-summary">
    {assets.length ? (
      assets.map((asset) => (
        <span key={`${asset.name}-${asset.dataUrl.slice(0, 16)}`} className="file-chip">
          {asset.name}
        </span>
      ))
    ) : (
      <span className="file-empty">{emptyLabel}</span>
    )}
  </div>
);

const MetaSummary = ({ message }: { message: StudioMessage }) => {
  if (!message.meta) {
    return null;
  }

  const { route, titles, coverCopy, hashtags, reviewSummary } = message.meta;

  if (!route && !titles?.length && !coverCopy && !hashtags?.length && !reviewSummary) {
    return null;
  }

  return (
    <div className="meta-block">
      {route ? (
        <div className="meta-row">
          <span className="meta-label">路线</span>
          <span className="mini-tag strong">{route}</span>
        </div>
      ) : null}

      {titles?.length ? (
        <div className="meta-row">
          <span className="meta-label">标题</span>
          <div className="meta-tags">
            {titles.map((title) => (
              <span key={title} className="mini-tag">
                {title}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {coverCopy ? (
        <div className="meta-row">
          <span className="meta-label">封面文案</span>
          <span className="mini-tag strong">{coverCopy}</span>
        </div>
      ) : null}

      {hashtags?.length ? (
        <div className="meta-row">
          <span className="meta-label">标签</span>
          <div className="meta-tags">
            {hashtags.map((tag) => (
              <span key={tag} className="mini-tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {reviewSummary ? <p className="message-note">{reviewSummary}</p> : null}
    </div>
  );
};

export function SkillStudio() {
  const [activeSkill, setActiveSkill] = useState<SkillId>("chanping-toutu");
  const [visualForm, setVisualForm] = useState<VisualForm>(visualDefaults);
  const [videoForm, setVideoForm] = useState<VideoForm>(videoDefaults);
  const [liveForm, setLiveForm] = useState<LiveForm>(liveDefaults);
  const [xhsForm, setXhsForm] = useState<XiaohongshuForm>(xhsDefaults);
  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const activeCard = skillCards.find((card) => card.id === activeSkill) || skillCards[0];
  const activeMeta = surfaceMeta[activeSkill];

  useEffect(() => {
    let cancelled = false;

    loadHistoryRecords().then((records) => {
      if (!cancelled) {
        setHistoryRecords(records);
      }
    });

    const storedProfile = loadUserProfile();
    setProfile(storedProfile);
    applyProfileDefaults(storedProfile, setVisualForm, setVideoForm, setLiveForm, setXhsForm);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, error]);

  const buildPayload = (): StudioPayload => {
    switch (activeSkill) {
      case "chanping-toutu":
        return { skill: activeSkill, form: visualForm };
      case "duanshipin-moban":
        return { skill: activeSkill, form: videoForm };
      case "zhibo-huashu":
        return { skill: activeSkill, form: liveForm };
      case "xiaohongshu-biji":
        return { skill: activeSkill, form: xhsForm };
      default:
        return { skill: "chanping-toutu", form: visualForm };
    }
  };

  const updateAssistantMessage = (messageId: string, patch: Partial<StudioMessage>) => {
    setMessages((prev) =>
      prev.map((message) => (message.id === messageId ? { ...message, ...patch } : message)),
    );
  };

  const prependHistory = (record: HistoryRecord) => {
    setHistoryRecords((prev) => [record, ...prev.filter((item) => item.id !== record.id)].slice(0, 24));
  };

  const finalizeRecord = async (payload: StudioPayload, userMessage: StudioMessage, result: AssistantResult) => {
    const assistantMessage: StudioMessage = {
      id: createId(),
      role: "assistant",
      skillId: payload.skill,
      title: result.type === "image" ? "已生成图片" : "已生成内容",
      content: result.text,
      createdAt: new Date().toISOString(),
      note: result.note,
      actions: result.actions,
      imageDataUrl: result.imageDataUrl,
      resultType: result.type,
      meta: result.meta,
    };

    const record: HistoryRecord = {
      id: createId(),
      skillId: payload.skill,
      title: getHistoryTitle(payload),
      summary: getHistorySummary(payload, result),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      starred: false,
      resultType: result.type,
      messages: [userMessage, assistantMessage],
      meta: result.meta,
    };

    await saveHistoryRecord(record);
    prependHistory(record);
    setSelectedHistoryId(record.id);
  };

  const submit = async () => {
    const payload = buildPayload();
    const userMessage: StudioMessage = {
      id: createId(),
      role: "user",
      skillId: payload.skill,
      title: getHistoryTitle(payload),
      content: buildUserSummary(payload),
      createdAt: new Date().toISOString(),
    };

    const assistantId = createId();
    const assistantPlaceholder: StudioMessage = {
      id: assistantId,
      role: "assistant",
      skillId: payload.skill,
      title: activeMeta.submitText,
      content: "",
      note: activeMeta.pendingText,
      createdAt: new Date().toISOString(),
    };

    setError("");
    setSelectedHistoryId("");
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 240_000);

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

        if (!response.ok || !response.body) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error || "生成失败，请稍后重试。");
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
          let lineBreakIndex = buffer.indexOf("\n");

          while (lineBreakIndex >= 0) {
            const line = buffer.slice(0, lineBreakIndex).trim();
            buffer = buffer.slice(lineBreakIndex + 1);

            if (line) {
              const event = JSON.parse(line) as StreamEvent;

              if (event.type === "status") {
                updateAssistantMessage(assistantId, { note: event.message });
              }

              if (event.type === "chunk") {
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === assistantId
                      ? { ...message, content: `${message.content}${event.text}` }
                      : message,
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

            lineBreakIndex = buffer.indexOf("\n");
          }
        }

        if (finalResult) {
          await finalizeRecord(payload, userMessage, finalResult);
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

        const data = (await response.json()) as AssistantResult & { error?: string };

        if (!response.ok) {
          throw new Error(data?.error || "生成失败，请稍后重试。");
        }

        updateAssistantMessage(assistantId, {
          content: data.text,
          note: data.note,
          actions: data.actions,
          imageDataUrl: data.imageDataUrl,
          resultType: data.type,
          meta: data.meta,
        });

        await finalizeRecord(payload, userMessage, data);
      }
    } catch (submitError) {
      setError(getErrorText(submitError));
      updateAssistantMessage(assistantId, {
        note: "这次没有顺利生成出来，可以调整信息后再试一次。",
      });
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setSelectedHistoryId("");
    setError("");
  };

  const openHistory = (record: HistoryRecord) => {
    setActiveSkill(record.skillId);
    setMessages(record.messages);
    setSelectedHistoryId(record.id);
    setError("");
  };

  const toggleHistoryStar = async (recordId: string) => {
    const target = historyRecords.find((record) => record.id === recordId);
    if (!target) {
      return;
    }

    const nextRecord = {
      ...target,
      starred: !target.starred,
      updatedAt: new Date().toISOString(),
    };

    await saveHistoryRecord(nextRecord);
    prependHistory(nextRecord);
  };

  const removeHistory = async (recordId: string) => {
    await deleteHistoryRecord(recordId);
    setHistoryRecords((prev) => prev.filter((item) => item.id !== recordId));

    if (selectedHistoryId === recordId) {
      startNewChat();
    }
  };

  const saveProfile = () => {
    saveUserProfile(profile);
    applyProfileDefaults(profile, setVisualForm, setVideoForm, setLiveForm, setXhsForm);
    setSettingsOpen(false);
  };

  return (
    <main className="page-shell">
      <div className="page-glow" aria-hidden="true" />

      <section className="studio-shell">
        <aside className="sidebar">
          <div className="sidebar-top">
            <div className="sidebar-brand">
              <span className="sidebar-kicker">Store Studio</span>
              <h1>门店内容工作台</h1>
              <p>像聊天一样做图、写脚本、出直播和小红书。</p>
            </div>

            <button type="button" className="ghost-button" onClick={startNewChat}>
              新建对话
            </button>
          </div>

          <nav className="skill-list">
            {skillCards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`skill-item${activeSkill === card.id ? " active" : ""}`}
                onClick={() => setActiveSkill(card.id)}
              >
                <span className="skill-index">{card.index}</span>
                <span className="skill-copy">
                  <strong>{card.title}</strong>
                  <span>{card.blurb}</span>
                </span>
              </button>
            ))}
          </nav>

          <section className="history-section">
            <div className="section-head">
              <span className="section-label">历史</span>
            </div>

            <div className="history-list">
              {historyRecords.length ? (
                historyRecords.map((record) => (
                  <div
                    key={record.id}
                    className={`history-item${selectedHistoryId === record.id ? " active" : ""}`}
                  >
                    <button type="button" className="history-main" onClick={() => openHistory(record)}>
                      <strong>{record.title}</strong>
                      <span>{record.summary}</span>
                      <small>{formatTime(record.updatedAt)}</small>
                    </button>

                    <div className="history-actions">
                      <button
                        type="button"
                        className={`icon-button${record.starred ? " active" : ""}`}
                        onClick={() => void toggleHistoryStar(record.id)}
                        aria-label="收藏"
                      >
                        ★
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => void removeHistory(record.id)}
                        aria-label="删除"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="history-empty">还没有历史记录。</p>
              )}
            </div>
          </section>

          <div className="sidebar-footer">
            <button type="button" className="ghost-button" onClick={() => setSettingsOpen(true)}>
              用户信息
            </button>
          </div>
        </aside>

        <section className="workspace">
          <header className="workspace-header">
            <div className="workspace-title">
              <span className="workspace-kicker">{activeCard.kicker}</span>
              <h2>{activeCard.title}</h2>
              <p>{activeCard.blurb}</p>
            </div>

            <div className="tag-row">
              <span className="scope-pill">{activeMeta.scope}</span>
              {activeCard.tags.map((tag) => (
                <span key={tag} className="tag-pill">
                  {tag}
                </span>
              ))}
            </div>
          </header>

          <section className="thread-panel">
            {messages.length ? (
              <>
                {messages.map((message) => (
                  <article key={message.id} className={`message-card ${message.role}`}>
                    <div className="message-head">
                      <div>
                        <strong>{message.title}</strong>
                        <span className="message-role">
                          {message.role === "user" ? "输入" : "结果"} · {formatTime(message.createdAt)}
                        </span>
                      </div>
                    </div>

                    {message.note ? <p className="message-note">{message.note}</p> : null}

                    {message.imageDataUrl ? (
                      <div className="result-image-wrap">
                        <Image
                          className="result-image"
                          src={message.imageDataUrl}
                          alt={message.title}
                          width={1536}
                          height={1024}
                          unoptimized
                        />
                        <a className="download-link" href={message.imageDataUrl} download={`${message.title}.png`}>
                          下载图片
                        </a>
                      </div>
                    ) : null}

                    {message.content ? <pre className="result-text">{message.content}</pre> : null}

                    {message.actions?.length ? (
                      <ul className="result-actions">
                        {message.actions.map((action) => (
                          <li key={action}>{action}</li>
                        ))}
                      </ul>
                    ) : null}

                    <MetaSummary message={message} />
                  </article>
                ))}
                <div ref={endRef} />
              </>
            ) : (
              <div className="thread-empty">
                <div>
                  <strong>{activeCard.title}</strong>
                  <p>{activeMeta.emptyText}</p>
                </div>
              </div>
            )}

            {error ? <p className="error-banner">{error}</p> : null}
          </section>

          <section className="composer-panel">
            <div className="composer-top">
              <div>
                <span className="card-kicker">INPUT</span>
                <h3>输入内容</h3>
              </div>

              <div className="composer-actions">
                <button type="button" className="ghost-button" onClick={startNewChat}>
                  清空会话
                </button>
                <button type="button" className="submit-button" onClick={() => void submit()} disabled={loading}>
                  {loading ? "处理中..." : activeMeta.submitText}
                </button>
              </div>
            </div>

            <div className="form-grid">
              {activeSkill === "chanping-toutu" ? (
                <>
                  <ChoiceField
                    label="设计类型"
                    value={visualForm.designType}
                    options={designOptions}
                    onChange={(designType) => setVisualForm((prev) => ({ ...prev, designType }))}
                    className="span-2"
                  />

                  <Field label="门店名称">
                    <input
                      value={visualForm.storeName}
                      onChange={(event) => setVisualForm((prev) => ({ ...prev, storeName: event.target.value }))}
                      placeholder="CC GYM 新街口店"
                    />
                  </Field>

                  <Field label="产品名称">
                    <input
                      value={visualForm.productName}
                      onChange={(event) => setVisualForm((prev) => ({ ...prev, productName: event.target.value }))}
                      placeholder="99元健身月卡"
                    />
                  </Field>

                  <Field label="价格信息">
                    <input
                      value={visualForm.price}
                      onChange={(event) => setVisualForm((prev) => ({ ...prev, price: event.target.value }))}
                      placeholder="99元 / 原价259元"
                    />
                  </Field>

                  <Field label="主题色">
                    <input
                      value={visualForm.themeColor}
                      onChange={(event) => setVisualForm((prev) => ({ ...prev, themeColor: event.target.value }))}
                      placeholder="薄荷青 / #69d7d1"
                    />
                  </Field>

                  <Field label="产品权益" className="span-2">
                    <textarea
                      value={visualForm.benefits}
                      onChange={(event) => setVisualForm((prev) => ({ ...prev, benefits: event.target.value }))}
                      placeholder="免费淋浴 / 免费停车 / 巡场教练 / 体测"
                    />
                  </Field>

                  <Field label="补充要求" className="span-2">
                    <textarea
                      value={visualForm.extraNotes}
                      onChange={(event) => setVisualForm((prev) => ({ ...prev, extraNotes: event.target.value }))}
                      placeholder="如：像样板图一，主标题更大，少小字。"
                    />
                  </Field>

                  <Field label="Logo 素材" className="span-2">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async (event) => {
                        const assets = await readFiles(event.target.files);
                        setVisualForm((prev) => ({ ...prev, logoAssets: assets }));
                      }}
                    />
                    <UploadSummary assets={visualForm.logoAssets} emptyLabel="还没有上传 Logo" />
                  </Field>

                  <Field label="参考样图" className="span-2" hint="可选">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async (event) => {
                        const assets = await readFiles(event.target.files);
                        setVisualForm((prev) => ({ ...prev, referenceAssets: assets }));
                      }}
                    />
                    <UploadSummary assets={visualForm.referenceAssets} emptyLabel="还没有上传参考图" />
                  </Field>
                </>
              ) : null}

              {activeSkill === "duanshipin-moban" ? (
                <>
                  <ChoiceField
                    label="脚本路线"
                    value={videoForm.route}
                    options={videoRoutes}
                    onChange={(route) => setVideoForm((prev) => ({ ...prev, route }))}
                    className="span-2"
                  />

                  <Field label="视频目标">
                    <input
                      value={videoForm.goal}
                      onChange={(event) => setVideoForm((prev) => ({ ...prev, goal: event.target.value }))}
                      placeholder="转化 / 信任 / 预热"
                    />
                  </Field>

                  <Field label="产品名称">
                    <input
                      value={videoForm.productName}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, productName: event.target.value }))
                      }
                      placeholder="99元健身月卡"
                    />
                  </Field>

                  <Field label="价格信息">
                    <input
                      value={videoForm.price}
                      onChange={(event) => setVideoForm((prev) => ({ ...prev, price: event.target.value }))}
                      placeholder="营销路线可填"
                    />
                  </Field>

                  <Field label="目标人群">
                    <input
                      value={videoForm.targetAudience}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, targetAudience: event.target.value }))
                      }
                      placeholder="附近上班族 / 新手减脂"
                    />
                  </Field>

                  <Field label="门店卖点" className="span-2">
                    <textarea
                      value={videoForm.storeAdvantages}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, storeAdvantages: event.target.value }))
                      }
                      placeholder="1000平场地 / 百台进口器械 / 免费淋浴 / 免费停车"
                    />
                  </Field>

                  <Field label="参考资料" className="span-2">
                    <textarea
                      value={videoForm.sourceNotes}
                      onChange={(event) => setVideoForm((prev) => ({ ...prev, sourceNotes: event.target.value }))}
                      placeholder="飞书笔记、账号观察、参考表达都可以放这里。"
                    />
                  </Field>

                  <Field label="补充要求" className="span-2">
                    <textarea
                      value={videoForm.extraNotes}
                      onChange={(event) => setVideoForm((prev) => ({ ...prev, extraNotes: event.target.value }))}
                      placeholder="如：更口语一点，多场景，更像真实出镜。"
                    />
                  </Field>
                </>
              ) : null}

              {activeSkill === "zhibo-huashu" ? (
                <>
                  <ChoiceField
                    label="任务模式"
                    value={liveForm.mode}
                    options={liveModes}
                    onChange={(mode) => setLiveForm((prev) => ({ ...prev, mode }))}
                    className="span-2"
                  />

                  <Field label="门店位置">
                    <input
                      value={liveForm.location}
                      onChange={(event) => setLiveForm((prev) => ({ ...prev, location: event.target.value }))}
                      placeholder="南京新街口三楼"
                    />
                  </Field>

                  <Field label="活动主题">
                    <input
                      value={liveForm.campaignTheme}
                      onChange={(event) =>
                        setLiveForm((prev) => ({ ...prev, campaignTheme: event.target.value }))
                      }
                      placeholder="新店预售"
                    />
                  </Field>

                  <Field label="直播目标">
                    <input
                      value={liveForm.goal}
                      onChange={(event) => setLiveForm((prev) => ({ ...prev, goal: event.target.value }))}
                      placeholder="成交 / 核销 / 逼单"
                    />
                  </Field>

                  <Field label="适合人群">
                    <input
                      value={liveForm.targetAudience}
                      onChange={(event) =>
                        setLiveForm((prev) => ({ ...prev, targetAudience: event.target.value }))
                      }
                      placeholder="附近想办月卡的新客"
                    />
                  </Field>

                  <Field label="门店优势" className="span-2">
                    <textarea
                      value={liveForm.storeAdvantages}
                      onChange={(event) =>
                        setLiveForm((prev) => ({ ...prev, storeAdvantages: event.target.value }))
                      }
                      placeholder="1000平场地 / 5米挑高 / 百台进口器械 / 免费淋浴"
                    />
                  </Field>

                  <Field label="团单内容" className="span-2">
                    <textarea
                      value={liveForm.offerContent}
                      onChange={(event) => setLiveForm((prev) => ({ ...prev, offerContent: event.target.value }))}
                      placeholder="99元健身月卡 + 核心权益"
                    />
                  </Field>

                  <Field label="已有话术" className="span-2">
                    <textarea
                      value={liveForm.currentScript}
                      onChange={(event) =>
                        setLiveForm((prev) => ({ ...prev, currentScript: event.target.value }))
                      }
                      placeholder="优化模式可直接粘贴原稿。"
                    />
                  </Field>

                  <Field label="补充要求" className="span-2">
                    <textarea
                      value={liveForm.extraNotes}
                      onChange={(event) => setLiveForm((prev) => ({ ...prev, extraNotes: event.target.value }))}
                      placeholder="如：逼单更强，7天内核销送小礼品。"
                    />
                  </Field>
                </>
              ) : null}

              {activeSkill === "xiaohongshu-biji" ? (
                <>
                  <ChoiceField
                    label="输出类型"
                    value={xhsForm.outputType}
                    options={xhsOutputs}
                    onChange={(outputType) =>
                      setXhsForm((prev) => ({
                        ...prev,
                        outputType: outputType as XiaohongshuForm["outputType"],
                      }))
                    }
                    className="span-2"
                  />

                  <ChoiceField
                    label="笔记路线"
                    value={xhsForm.route}
                    options={xhsRoutes}
                    onChange={(route) => setXhsForm((prev) => ({ ...prev, route }))}
                    className="span-2"
                  />

                  <Field label="门店名称">
                    <input
                      value={xhsForm.storeName}
                      onChange={(event) => setXhsForm((prev) => ({ ...prev, storeName: event.target.value }))}
                      placeholder="CC GYM 新街口店"
                    />
                  </Field>

                  <Field label="门店位置">
                    <input
                      value={xhsForm.location}
                      onChange={(event) => setXhsForm((prev) => ({ ...prev, location: event.target.value }))}
                      placeholder="南京新街口"
                    />
                  </Field>

                  <Field label="产品或主题">
                    <input
                      value={xhsForm.productName}
                      onChange={(event) => setXhsForm((prev) => ({ ...prev, productName: event.target.value }))}
                      placeholder="99元健身月卡 / 新手减脂体验"
                    />
                  </Field>

                  <Field label="笔记目的">
                    <input
                      value={xhsForm.goal}
                      onChange={(event) => setXhsForm((prev) => ({ ...prev, goal: event.target.value }))}
                      placeholder="团购转化 / 种草进店 / 建立信任"
                    />
                  </Field>

                  <Field label="价格信息">
                    <input
                      value={xhsForm.price}
                      onChange={(event) => setXhsForm((prev) => ({ ...prev, price: event.target.value }))}
                      placeholder="仅团购转化型建议填写"
                    />
                  </Field>

                  <Field label="主题色">
                    <input
                      value={xhsForm.themeColor}
                      onChange={(event) => setXhsForm((prev) => ({ ...prev, themeColor: event.target.value }))}
                      placeholder="薄荷青 / #69d7d1"
                    />
                  </Field>

                  <Field label="目标人群">
                    <input
                      value={xhsForm.targetAudience}
                      onChange={(event) =>
                        setXhsForm((prev) => ({ ...prev, targetAudience: event.target.value }))
                      }
                      placeholder="附近白领 / 新手健身 / 减脂女生"
                    />
                  </Field>

                  <Field label="语气要求">
                    <input
                      value={xhsForm.tone}
                      onChange={(event) => setXhsForm((prev) => ({ ...prev, tone: event.target.value }))}
                      placeholder="真实 / 轻松 / 干净 / 像真实体验"
                    />
                  </Field>

                  <Field label="产品权益" className="span-2">
                    <textarea
                      value={xhsForm.benefits}
                      onChange={(event) => setXhsForm((prev) => ({ ...prev, benefits: event.target.value }))}
                      placeholder="免费淋浴 / 免费停车 / 巡场教练 / 体测"
                    />
                  </Field>

                  <Field label="门店卖点" className="span-2">
                    <textarea
                      value={xhsForm.storeHighlights}
                      onChange={(event) =>
                        setXhsForm((prev) => ({ ...prev, storeHighlights: event.target.value }))
                      }
                      placeholder="1000平场地 / 百台进口器械 / 24小时通风系统"
                    />
                  </Field>

                  <Field label="参考风格" className="span-2">
                    <textarea
                      value={xhsForm.referenceStyle}
                      onChange={(event) =>
                        setXhsForm((prev) => ({ ...prev, referenceStyle: event.target.value }))
                      }
                      placeholder="想要的笔记感觉、对标账号、封面风格都可以写这里。"
                    />
                  </Field>

                  <Field label="常用话题词" className="span-2">
                    <textarea
                      value={xhsForm.hashtags}
                      onChange={(event) => setXhsForm((prev) => ({ ...prev, hashtags: event.target.value }))}
                      placeholder="#健身房 #本地生活 #减脂 #月卡"
                    />
                  </Field>

                  <Field label="补充要求" className="span-2">
                    <textarea
                      value={xhsForm.extraNotes}
                      onChange={(event) => setXhsForm((prev) => ({ ...prev, extraNotes: event.target.value }))}
                      placeholder="如：不要太广告，封面更清爽。"
                    />
                  </Field>

                  <Field label="Logo 素材" className="span-2" hint="封面图可选">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async (event) => {
                        const assets = await readFiles(event.target.files);
                        setXhsForm((prev) => ({ ...prev, logoAssets: assets }));
                      }}
                    />
                    <UploadSummary assets={xhsForm.logoAssets} emptyLabel="还没有上传 Logo" />
                  </Field>

                  <Field label="参考样图" className="span-2" hint="封面图可选">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async (event) => {
                        const assets = await readFiles(event.target.files);
                        setXhsForm((prev) => ({ ...prev, referenceAssets: assets }));
                      }}
                    />
                    <UploadSummary assets={xhsForm.referenceAssets} emptyLabel="还没有上传参考图" />
                  </Field>
                </>
              ) : null}
            </div>
          </section>
        </section>
      </section>

      {settingsOpen ? (
        <div className="settings-backdrop" onClick={() => setSettingsOpen(false)}>
          <section className="settings-panel" onClick={(event) => event.stopPropagation()}>
            <div className="settings-head">
              <div>
                <span className="card-kicker">SETTINGS</span>
                <h3>用户信息收集</h3>
              </div>
              <button type="button" className="icon-button" onClick={() => setSettingsOpen(false)}>
                ×
              </button>
            </div>

            <div className="form-grid compact">
              <Field label="常用门店名">
                <input
                  value={profile.storeName}
                  onChange={(event) => setProfile((prev) => ({ ...prev, storeName: event.target.value }))}
                  placeholder="CC GYM 新街口店"
                />
              </Field>

              <Field label="常用位置">
                <input
                  value={profile.location}
                  onChange={(event) => setProfile((prev) => ({ ...prev, location: event.target.value }))}
                  placeholder="南京新街口"
                />
              </Field>

              <Field label="常用主题色">
                <input
                  value={profile.themeColor}
                  onChange={(event) => setProfile((prev) => ({ ...prev, themeColor: event.target.value }))}
                  placeholder="薄荷青 / #69d7d1"
                />
              </Field>

              <Field label="笔记常用语气">
                <input
                  value={profile.noteTone}
                  onChange={(event) => setProfile((prev) => ({ ...prev, noteTone: event.target.value }))}
                  placeholder="真实、轻松、像体验分享"
                />
              </Field>

              <Field label="常用门店标签" className="span-2">
                <textarea
                  value={profile.storeTags}
                  onChange={(event) => setProfile((prev) => ({ ...prev, storeTags: event.target.value }))}
                  placeholder="24小时通风 / 进口器械 / 免费停车 / 免费淋浴"
                />
              </Field>

              <Field label="默认目标人群">
                <input
                  value={profile.defaultAudience}
                  onChange={(event) => setProfile((prev) => ({ ...prev, defaultAudience: event.target.value }))}
                  placeholder="附近白领 / 新手减脂 / 月卡用户"
                />
              </Field>

              <Field label="默认封面风格">
                <input
                  value={profile.coverStyle}
                  onChange={(event) => setProfile((prev) => ({ ...prev, coverStyle: event.target.value }))}
                  placeholder="清爽 / 对比强 / 高点击封面"
                />
              </Field>

              <Field label="常用话题词" className="span-2">
                <textarea
                  value={profile.topicWords}
                  onChange={(event) => setProfile((prev) => ({ ...prev, topicWords: event.target.value }))}
                  placeholder="#健身房 #本地生活 #减脂 #训练日常"
                />
              </Field>
            </div>

            <div className="settings-actions">
              <button type="button" className="ghost-button" onClick={() => setSettingsOpen(false)}>
                取消
              </button>
              <button type="button" className="submit-button" onClick={saveProfile}>
                保存信息
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
