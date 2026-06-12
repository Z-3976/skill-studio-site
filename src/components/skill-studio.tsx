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
    provider: string;
    submitText: string;
    helper: string;
    emptyTitle: string;
    emptyText: string;
  }
> = {
  "chanping-toutu": {
    scope: "Logo / 产品 / 主题色",
    provider: "DeepSeek 组稿 · GPT-Image 2 出图",
    submitText: "生成图片",
    helper: "头图默认 4:3；中间 1:1 安全区；KT 板自动切换竖版逻辑。",
    emptyTitle: "等待视觉结果",
    emptyText: "生成后，这里会直接出现图片或最终生图提示词。",
  },
  "duanshipin-moban": {
    scope: "路线 / 卖点 / 人群",
    provider: "DeepSeek 文本",
    submitText: "生成脚本",
    helper: "营销视频可带价格；轻 IP 和素人路线默认不带营销口径。",
    emptyTitle: "等待脚本结果",
    emptyText: "生成后，这里会直接出现可拍版文案。",
  },
  "zhibo-huashu": {
    scope: "位置 / 团单 / 成交流程",
    provider: "DeepSeek 文本",
    submitText: "生成话术",
    helper: "固定顺序：开场 → 优势 → 痛点 → 三拆 → 逼单 → 保障 → 核销。",
    emptyTitle: "等待直播话术",
    emptyText: "生成后，这里会直接出现可复用话术。",
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
  <label className={`field-shell${className ? ` ${className}` : ""}`}>
    <span className="field-head">
      <span className="field-label">{label}</span>
      {aside}
    </span>
    {children}
    {hint ? <span className="field-hint">{hint}</span> : null}
  </label>
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
      <span className="file-summary-empty">{emptyLabel}</span>
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
    if (loading) {
      return "生成中";
    }

    if (!result.type) {
      return "就绪";
    }

    if (result.type === "image") {
      return "图片";
    }

    if (result.type === "prompt") {
      return "提示词";
    }

    return "文本";
  }, [loading, result.type]);

  const themePreview = useMemo(() => {
    const color = visualForm.themeColor.trim();
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : "";
  }, [visualForm.themeColor]);

  const submit = async () => {
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
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as ResultState & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "生成失败，请稍后重试。");
      }

      setResult({
        type: data.type,
        text: data.text,
        note: data.note,
        actions: data.actions,
        imageDataUrl: data.imageDataUrl,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "生成失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-shell">
      <div className="ambient-layer" aria-hidden="true">
        <span className="ambient-orb orb-left" />
        <span className="ambient-orb orb-right" />
        <span className="ambient-orb orb-bottom" />
        <span className="ambient-grid" />
        <span className="ambient-beam" />
      </div>

      <section className="studio-frame">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <span className="eyebrow">Skill Workspace</span>
            <h1>简洁一点，更像 Codex。</h1>
            <p>DeepSeek 优先，只有图片生成才调用 OpenAI。</p>
          </div>

          <nav className="skill-stack" aria-label="技能切换">
            {skillCards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`skill-tile${activeSkill === card.id ? " active" : ""}`}
                onClick={() => setActiveSkill(card.id)}
              >
                <span className="skill-number">{card.index}</span>
                <div className="skill-tile-copy">
                  <strong>{card.title}</strong>
                  <span>{card.blurb}</span>
                </div>
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-footer-row">
              <span>Text</span>
              <strong>DeepSeek</strong>
            </div>
            <div className="sidebar-footer-row">
              <span>Image</span>
              <strong>GPT-Image 2</strong>
            </div>
          </div>
        </aside>

        <section className="workspace">
          <header className="workspace-header">
            <div className="workspace-title">
              <span className="eyebrow">{activeCard.kicker}</span>
              <h2>{activeCard.title}</h2>
            </div>

            <div className="workspace-pills">
              <span className="meta-pill accent">{activeMeta.provider}</span>
              {activeCard.tags.map((tag) => (
                <span key={tag} className="meta-pill">
                  {tag}
                </span>
              ))}
            </div>
          </header>

          <section className="workspace-grid">
            <section className="composer-card">
              <div className="card-head">
                <div>
                  <span className="eyebrow">Input</span>
                  <h3>参数</h3>
                </div>
                <span className="corner-chip">{activeMeta.scope}</span>
              </div>

              <div className="form-stage">
                {activeSkill === "chanping-toutu" ? (
                  <div className="input-grid">
                    <Field label="设计类型">
                      <select
                        value={visualForm.designType}
                        onChange={(event) =>
                          setVisualForm((prev) => ({ ...prev, designType: event.target.value }))
                        }
                      >
                        {designOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </Field>

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

                    <Field label="产品权益" className="span-2">
                      <textarea
                        value={visualForm.benefits}
                        onChange={(event) =>
                          setVisualForm((prev) => ({ ...prev, benefits: event.target.value }))
                        }
                        placeholder="每条一行：免费淋浴 / 免费停车 / 巡场教练 / 体测"
                      />
                    </Field>

                    <Field
                      label="主题色"
                      aside={
                        themePreview ? (
                          <span className="color-swatch" style={{ backgroundColor: themePreview }} />
                        ) : null
                      }
                    >
                      <input
                        value={visualForm.themeColor}
                        onChange={(event) =>
                          setVisualForm((prev) => ({ ...prev, themeColor: event.target.value }))
                        }
                        placeholder="薄荷青 / #69d7d1"
                      />
                    </Field>

                    <Field label="风格补充">
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
                  <div className="input-grid">
                    <Field label="脚本路线">
                      <select
                        value={videoForm.route}
                        onChange={(event) =>
                          setVideoForm((prev) => ({ ...prev, route: event.target.value }))
                        }
                      >
                        {videoRoutes.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </Field>

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

                    <Field label="门店卖点" className="span-2">
                      <textarea
                        value={videoForm.storeAdvantages}
                        onChange={(event) =>
                          setVideoForm((prev) => ({ ...prev, storeAdvantages: event.target.value }))
                        }
                        placeholder="1000 平场地 / 百台进口器械 / 免费淋浴 / 免费停车"
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

                    <Field label="补充要求">
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
                  <div className="input-grid">
                    <Field label="任务模式">
                      <select
                        value={liveForm.mode}
                        onChange={(event) =>
                          setLiveForm((prev) => ({ ...prev, mode: event.target.value }))
                        }
                      >
                        {liveModes.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </Field>

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

                    <Field label="适合人群">
                      <input
                        value={liveForm.targetAudience}
                        onChange={(event) =>
                          setLiveForm((prev) => ({ ...prev, targetAudience: event.target.value }))
                        }
                        placeholder="附近想办月卡的新客"
                      />
                    </Field>

                    <Field label="补充要求">
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
              </div>

              <div className="card-foot">
                <p>{activeMeta.helper}</p>
                <button type="button" className="submit-button" onClick={submit} disabled={loading}>
                  {loading ? "生成中..." : activeMeta.submitText}
                </button>
              </div>
            </section>

            <section className="result-card">
              <div className="card-head">
                <div>
                  <span className="eyebrow">Output</span>
                  <h3>结果</h3>
                </div>
                <span className="corner-chip ghost">{resultBadge}</span>
              </div>

              <div className={`result-stage${!error && !result.type ? " empty" : ""}`}>
                {error ? <p className="error-text">{error}</p> : null}

                {!error && !result.type ? (
                  <div className="result-placeholder">
                    <span className="placeholder-core" />
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
                      下载 PNG
                    </a>
                  </div>
                ) : null}

                {result.text ? <pre className="result-text">{result.text}</pre> : null}
              </div>
            </section>
          </section>
        </section>
      </section>
    </main>
  );
}
