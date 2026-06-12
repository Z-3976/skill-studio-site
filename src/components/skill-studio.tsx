"use client";

import { useMemo, useState, type ReactNode } from "react";
import { skillCards, type SkillId } from "@/lib/site-data";
import type { UploadAsset } from "@/lib/skill-prompts";

type ResultState = {
  type: "text" | "image" | "prompt" | null;
  text: string;
  note?: string;
  actions?: string[];
  imageDataUrl?: string;
};

type VisualForm = {
  designType: string;
  storeName: string;
  productName: string;
  price: string;
  benefits: string;
  themeColor: string;
  extraNotes: string;
  logoAssets: UploadAsset[];
  referenceAssets: UploadAsset[];
};

type VideoForm = {
  route: string;
  goal: string;
  productName: string;
  price: string;
  storeAdvantages: string;
  targetAudience: string;
  sourceNotes: string;
  extraNotes: string;
};

type LiveForm = {
  mode: string;
  location: string;
  campaignTheme: string;
  storeAdvantages: string;
  offerContent: string;
  goal: string;
  targetAudience: string;
  currentScript: string;
  extraNotes: string;
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

const designOptions = [
  "产品头图",
  "团购头图",
  "套餐图",
  "A4 KT 板",
  "A3 KT 板",
  "健身月卡",
  "私教周卡",
  "门店宣传图",
];

const videoRoutes = [
  "营销短视频",
  "官方轻 IP（3km 大众熟人）",
  "素人氛围号",
  "预热视频 / 核销视频 / 引流视频",
];

const liveModes = ["生成模式", "优化模式"];

const surfaceMeta: Record<
  SkillId,
  {
    scope: string;
    submitText: string;
    helper: string;
    emptyTitle: string;
    emptyText: string;
  }
> = {
  "chanping-toutu": {
    scope: "Logo / 产品 / 主题色",
    submitText: "生成图片",
    helper: "头图默认 4:3，核心信息自动按安全区整理；KT 板使用竖版逻辑。",
    emptyTitle: "等待结果",
    emptyText: "生成后，这里会显示图片或最终提示词。",
  },
  "duanshipin-moban": {
    scope: "路线 / 卖点 / 人群",
    submitText: "生成脚本",
    helper: "营销路线可带价格，轻 IP 和氛围路线默认不带营销口径。",
    emptyTitle: "等待结果",
    emptyText: "生成后，这里会显示可直接拍的脚本。",
  },
  "zhibo-huashu": {
    scope: "位置 / 团单 / 成交流程",
    submitText: "生成话术",
    helper: "固定顺序：开场、优势、痛点、三拆、逼单、保障、核销。",
    emptyTitle: "等待结果",
    emptyText: "生成后，这里会显示可直接使用的话术。",
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

const getErrorText = (error: unknown) => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "生成超时，请稍后重试。";
  }

  if (error instanceof Error) {
    if (error.message === "Failed to fetch") {
      return "请求没有成功，请稍后重试。";
    }

    return error.message;
  }

  return "生成失败，请稍后重试。";
};

const Field = ({
  label,
  children,
  hint,
  aside,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  aside?: ReactNode;
  className?: string;
}) => (
  <div className={`field-card${className ? ` ${className}` : ""}`}>
    <div className="field-top">
      <span className="field-label">{label}</span>
      {aside}
    </div>
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
      assets.map((asset, index) => (
        <span key={`${asset.name}-${index}`} className="file-chip">
          {asset.name}
        </span>
      ))
    ) : (
      <span className="file-empty">{emptyLabel}</span>
    )}
  </div>
);

export function SkillStudio() {
  const [activeSkill, setActiveSkill] = useState<SkillId>("chanping-toutu");
  const [visualForm, setVisualForm] = useState<VisualForm>(visualDefaults);
  const [videoForm, setVideoForm] = useState<VideoForm>(videoDefaults);
  const [liveForm, setLiveForm] = useState<LiveForm>(liveDefaults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResultState>({ type: null, text: "" });

  const activeCard = useMemo(
    () => skillCards.find((card) => card.id === activeSkill) || skillCards[0],
    [activeSkill],
  );

  const activeMeta = surfaceMeta[activeSkill];

  const resultBadge = useMemo(() => {
    if (loading) return "生成中";
    if (!result.type) return "待生成";
    if (result.type === "image") return "图片";
    if (result.type === "prompt") return "提示词";
    return "文本";
  }, [loading, result.type]);

  const themePreview = useMemo(() => {
    const color = visualForm.themeColor.trim();
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : "";
  }, [visualForm.themeColor]);

  const submit = async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30_000);

    setLoading(true);
    setError("");
    setResult({ type: null, text: "" });

    const payload =
      activeSkill === "chanping-toutu"
        ? { skill: activeSkill, form: visualForm }
        : activeSkill === "duanshipin-moban"
          ? { skill: activeSkill, form: videoForm }
          : { skill: activeSkill, form: liveForm };

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? ((await response.json()) as ResultState & { error?: string })
        : null;

      if (!response.ok) {
        throw new Error(data?.error || "生成失败，请稍后重试。");
      }

      if (!data) {
        throw new Error("结果暂时不可用，请稍后重试。");
      }

      setResult({
        type: data.type,
        text: data.text,
        note: data.note,
        actions: data.actions,
        imageDataUrl: data.imageDataUrl,
      });
    } catch (submitError) {
      setError(getErrorText(submitError));
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  return (
    <main className="page-shell">
      <div className="page-glow" aria-hidden="true" />

      <section className="studio-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <span className="sidebar-kicker">门店内容工作台</span>
            <h1>头图、短视频、直播话术</h1>
            <p>把常用内容放到一个页面里，更快完成生成和调整。</p>
          </div>

          <nav className="skill-list" aria-label="技能切换">
            {skillCards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`skill-item${activeSkill === card.id ? " active" : ""}`}
                onClick={() => setActiveSkill(card.id)}
              >
                <span className="skill-index">{card.index}</span>
                <div className="skill-copy">
                  <strong>{card.title}</strong>
                  <span>{card.blurb}</span>
                </div>
              </button>
            ))}
          </nav>
        </aside>

        <section className="workspace">
          <header className="workspace-header">
            <div className="workspace-title">
              <span className="workspace-kicker">{activeCard.kicker}</span>
              <h2>{activeCard.title}</h2>
              <p>{activeMeta.helper}</p>
            </div>

            <div className="tag-row">
              {activeCard.tags.map((tag) => (
                <span key={tag} className="tag-pill">
                  {tag}
                </span>
              ))}
            </div>
          </header>

          <div className="workspace-grid">
            <section className="editor-card">
              <div className="card-header">
                <div>
                  <span className="card-kicker">参数</span>
                  <h3>输入内容</h3>
                </div>
                <span className="scope-pill">{activeMeta.scope}</span>
              </div>

              {activeSkill === "chanping-toutu" ? (
                <div className="form-grid">
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
                      onChange={(event) =>
                        setVisualForm((prev) => ({ ...prev, storeName: event.target.value }))
                      }
                      placeholder="CC GYM 新街口店"
                    />
                  </Field>

                  <Field label="产品名称">
                    <input
                      value={visualForm.productName}
                      onChange={(event) =>
                        setVisualForm((prev) => ({ ...prev, productName: event.target.value }))
                      }
                      placeholder="99 元健身月卡"
                    />
                  </Field>

                  <Field label="价格信息">
                    <input
                      value={visualForm.price}
                      onChange={(event) =>
                        setVisualForm((prev) => ({ ...prev, price: event.target.value }))
                      }
                      placeholder="原价 259，活动价 99"
                    />
                  </Field>

                  <Field
                    label="主题色"
                    aside={themePreview ? <span className="color-dot" style={{ backgroundColor: themePreview }} /> : null}
                  >
                    <input
                      value={visualForm.themeColor}
                      onChange={(event) =>
                        setVisualForm((prev) => ({ ...prev, themeColor: event.target.value }))
                      }
                      placeholder="薄荷青 / #69d7d1"
                    />
                  </Field>

                  <Field label="产品权益" className="span-2">
                    <textarea
                      value={visualForm.benefits}
                      onChange={(event) =>
                        setVisualForm((prev) => ({ ...prev, benefits: event.target.value }))
                      }
                      placeholder="每条一行：免费淋浴 / 免费停车 / 巡场教练 / 体测"
                    />
                  </Field>

                  <Field label="补充要求" className="span-2">
                    <textarea
                      value={visualForm.extraNotes}
                      onChange={(event) =>
                        setVisualForm((prev) => ({ ...prev, extraNotes: event.target.value }))
                      }
                      placeholder="高级、清晰、少小字、有商业感"
                    />
                  </Field>

                  <Field label="Logo 素材" hint="支持多张" className="span-2">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async (event) => {
                        const assets = await readFiles(event.target.files);
                        setVisualForm((prev) => ({ ...prev, logoAssets: assets }));
                      }}
                    />
                    <UploadSummary assets={visualForm.logoAssets} emptyLabel="未上传 Logo" />
                  </Field>

                  <Field label="参考样板图" hint="可选" className="span-2">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async (event) => {
                        const assets = await readFiles(event.target.files);
                        setVisualForm((prev) => ({ ...prev, referenceAssets: assets }));
                      }}
                    />
                    <UploadSummary assets={visualForm.referenceAssets} emptyLabel="未上传样板图" />
                  </Field>
                </div>
              ) : null}

              {activeSkill === "duanshipin-moban" ? (
                <div className="form-grid">
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
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, goal: event.target.value }))
                      }
                      placeholder="转化 / 信任 / 预热"
                    />
                  </Field>

                  <Field label="产品名称">
                    <input
                      value={videoForm.productName}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, productName: event.target.value }))
                      }
                      placeholder="99 元健身月卡"
                    />
                  </Field>

                  <Field label="价格信息">
                    <input
                      value={videoForm.price}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, price: event.target.value }))
                      }
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
                      placeholder="1000 平场地 / 百台进口器械 / 免费淋浴 / 免费停车"
                    />
                  </Field>

                  <Field label="补充要求" className="span-2">
                    <textarea
                      value={videoForm.extraNotes}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, extraNotes: event.target.value }))
                      }
                      placeholder="口语化 / 多场景 / 节奏快一点"
                    />
                  </Field>

                  <Field label="参考资料" className="span-2">
                    <textarea
                      value={videoForm.sourceNotes}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, sourceNotes: event.target.value }))
                      }
                      placeholder="飞书笔记、账号观察、参考表达都可以放这里"
                    />
                  </Field>
                </div>
              ) : null}

              {activeSkill === "zhibo-huashu" ? (
                <div className="form-grid">
                  <ChoiceField
                    label="任务模式"
                    value={liveForm.mode}
                    options={liveModes}
                    onChange={(mode) => setLiveForm((prev) => ({ ...prev, mode }))}
                    className="span-2"
                  />

                  <Field label="直播目标">
                    <input
                      value={liveForm.goal}
                      onChange={(event) =>
                        setLiveForm((prev) => ({ ...prev, goal: event.target.value }))
                      }
                      placeholder="成交 / 核销 / 逼单"
                    />
                  </Field>

                  <Field label="门店位置">
                    <input
                      value={liveForm.location}
                      onChange={(event) =>
                        setLiveForm((prev) => ({ ...prev, location: event.target.value }))
                      }
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
                      placeholder="1000 平场地 / 5 米挑高 / 百台进口器械 / 免费淋浴"
                    />
                  </Field>

                  <Field label="团单内容" className="span-2">
                    <textarea
                      value={liveForm.offerContent}
                      onChange={(event) =>
                        setLiveForm((prev) => ({ ...prev, offerContent: event.target.value }))
                      }
                      placeholder="99 元健身月卡 + 核心权益"
                    />
                  </Field>

                  <Field label="补充要求" className="span-2">
                    <textarea
                      value={liveForm.extraNotes}
                      onChange={(event) =>
                        setLiveForm((prev) => ({ ...prev, extraNotes: event.target.value }))
                      }
                      placeholder="逼单更强 / 7 天内核销送礼"
                    />
                  </Field>

                  <Field label="已有话术" className="span-2">
                    <textarea
                      value={liveForm.currentScript}
                      onChange={(event) =>
                        setLiveForm((prev) => ({ ...prev, currentScript: event.target.value }))
                      }
                      placeholder="优化模式可直接粘贴原稿"
                    />
                  </Field>
                </div>
              ) : null}

              <div className="action-row">
                <button type="button" className="submit-button" onClick={submit} disabled={loading}>
                  {loading ? "生成中..." : activeMeta.submitText}
                </button>
              </div>
            </section>

            <section className="result-card">
              <div className="card-header">
                <div>
                  <span className="card-kicker">结果</span>
                  <h3>生成内容</h3>
                </div>
                <span className="scope-pill ghost">{resultBadge}</span>
              </div>

              <div className={`result-body${!error && !result.type ? " empty" : ""}`}>
                {error ? <p className="error-text">{error}</p> : null}

                {!error && !result.type ? (
                  <div className="result-placeholder">
                    <strong>{activeMeta.emptyTitle}</strong>
                    <p>{activeMeta.emptyText}</p>
                  </div>
                ) : null}

                {result.note ? <p className="result-note">{result.note}</p> : null}

                {result.actions?.length ? (
                  <ul className="result-actions">
                    {result.actions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                ) : null}

                {result.imageDataUrl ? (
                  <div className="result-image-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={result.imageDataUrl} alt="生成结果" className="result-image" />
                    <a href={result.imageDataUrl} download="skill-studio-result.png" className="download-link">
                      下载图片
                    </a>
                  </div>
                ) : null}

                {result.text ? <pre className="result-text">{result.text}</pre> : null}
              </div>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}
