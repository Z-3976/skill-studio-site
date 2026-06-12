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
  "A4 KT板",
  "A3 KT板",
  "健身月卡",
  "私教周卡",
  "门店宣传图",
];

const videoRoutes = [
  "营销短视频",
  "官方轻IP（3km大众熟人）",
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
    placeholder: string;
    emptyTitle: string;
    emptyText: string;
  }
> = {
  "chanping-toutu": {
    scope: "Logo / 产品 / 主题色",
    provider: "DeepSeek 文本 · GPT-Image 2 生图",
    submitText: "生成视觉",
    placeholder: "头图 / KT板 / 宣传图",
    emptyTitle: "等待生成视觉结果",
    emptyText: "填完左侧参数后开始生成，图片或最终提示词会直接落在这里。",
  },
  "duanshipin-moban": {
    scope: "路线 / 卖点 / 人群",
    provider: "DeepSeek 文本",
    submitText: "生成脚本",
    placeholder: "营销 / 轻IP / 氛围号",
    emptyTitle: "等待脚本结果",
    emptyText: "选好路线并补齐卖点后，右侧会直接给你可拍版本。",
  },
  "zhibo-huashu": {
    scope: "位置 / 团单 / 成交流程",
    provider: "DeepSeek 文本",
    submitText: "生成话术",
    placeholder: "开场 / 逼单 / 核销",
    emptyTitle: "等待直播话术",
    emptyText: "输入门店和团单信息后，右侧会按成交流程输出完整话术。",
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
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) => (
  <label className={`field${className ? ` ${className}` : ""}`}>
    <span className="field-label">{label}</span>
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
      return "Running";
    }

    if (!result.type) {
      return "Ready";
    }

    if (result.type === "image") {
      return "Image";
    }

    if (result.type === "prompt") {
      return "Prompt";
    }

    return "Text";
  }, [loading, result.type]);

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
        <span className="orb orb-a" />
        <span className="orb orb-b" />
        <span className="orb orb-c" />
        <span className="grid-haze" />
      </div>

      <section className="studio-shell">
        <aside className="skill-rail">
          <div className="rail-brand">
            <span className="rail-kicker">Skill Studio</span>
            <h1>深色、高级、直接开工。</h1>
            <p>DeepSeek 优先，OpenAI 只做生图。</p>
          </div>

          <div className="rail-status">
            <span className="status-pill">
              <i className="status-dot" />
              DeepSeek First
            </span>
            <span className="status-pill subtle">GPT-Image 2</span>
          </div>

          <nav className="skill-nav" aria-label="技能切换">
            {skillCards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`skill-nav-item${activeSkill === card.id ? " active" : ""}`}
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

          <div className="rail-footer">
            <span className="rail-footer-label">Current</span>
            <strong>{activeCard.title}</strong>
            <p>{activeMeta.placeholder}</p>
          </div>
        </aside>

        <section className="studio-main">
          <header className="workspace-topbar">
            <div>
              <span className="topbar-kicker">{activeCard.kicker}</span>
              <h2>{activeCard.title}</h2>
            </div>
            <div className="topbar-pills">
              {activeCard.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </header>

          <section className="workspace-panels">
            <div className="panel editor-panel">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">Input</span>
                  <h3>参数</h3>
                </div>
                <span className="panel-chip">{activeMeta.scope}</span>
              </div>

              <div className="form-scroll">
                {activeSkill === "chanping-toutu" ? (
                  <div className="form-grid">
                    <Field label="类型">
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
                    <Field label="门店">
                      <input
                        value={visualForm.storeName}
                        onChange={(event) =>
                          setVisualForm((prev) => ({ ...prev, storeName: event.target.value }))
                        }
                        placeholder="CC GYM 新街口店"
                      />
                    </Field>
                    <Field label="产品">
                      <input
                        value={visualForm.productName}
                        onChange={(event) =>
                          setVisualForm((prev) => ({ ...prev, productName: event.target.value }))
                        }
                        placeholder="99元健身月卡"
                      />
                    </Field>
                    <Field label="价格">
                      <input
                        value={visualForm.price}
                        onChange={(event) =>
                          setVisualForm((prev) => ({ ...prev, price: event.target.value }))
                        }
                        placeholder="原价259，现价99"
                      />
                    </Field>
                    <Field label="权益" className="span-2">
                      <textarea
                        value={visualForm.benefits}
                        onChange={(event) =>
                          setVisualForm((prev) => ({ ...prev, benefits: event.target.value }))
                        }
                        placeholder="每条一行：免费淋浴 / 免费停车 / 巡场教练 / 体测"
                      />
                    </Field>
                    <Field label="主题色">
                      <input
                        value={visualForm.themeColor}
                        onChange={(event) =>
                          setVisualForm((prev) => ({ ...prev, themeColor: event.target.value }))
                        }
                        placeholder="薄荷青 #69d7d1"
                      />
                    </Field>
                    <Field label="补充">
                      <textarea
                        value={visualForm.extraNotes}
                        onChange={(event) =>
                          setVisualForm((prev) => ({ ...prev, extraNotes: event.target.value }))
                        }
                        placeholder="高级、清晰、少小字"
                      />
                    </Field>
                    <Field label="Logo" hint="支持多张。" className="span-2">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={async (event) => {
                          const assets = await readFiles(event.target.files);
                          setVisualForm((prev) => ({ ...prev, logoAssets: assets }));
                        }}
                      />
                      <UploadSummary assets={visualForm.logoAssets} emptyLabel="未上传素材" />
                    </Field>
                    <Field label="样板图" hint="可选。" className="span-2">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={async (event) => {
                          const assets = await readFiles(event.target.files);
                          setVisualForm((prev) => ({ ...prev, referenceAssets: assets }));
                        }}
                      />
                      <UploadSummary assets={visualForm.referenceAssets} emptyLabel="未上传素材" />
                    </Field>
                  </div>
                ) : null}

                {activeSkill === "duanshipin-moban" ? (
                  <div className="form-grid">
                    <Field label="路线">
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
                    <Field label="目标">
                      <input
                        value={videoForm.goal}
                        onChange={(event) =>
                          setVideoForm((prev) => ({ ...prev, goal: event.target.value }))
                        }
                        placeholder="转化 / 信任 / 预热"
                      />
                    </Field>
                    <Field label="产品">
                      <input
                        value={videoForm.productName}
                        onChange={(event) =>
                          setVideoForm((prev) => ({ ...prev, productName: event.target.value }))
                        }
                        placeholder="99元健身月卡"
                      />
                    </Field>
                    <Field label="价格">
                      <input
                        value={videoForm.price}
                        onChange={(event) =>
                          setVideoForm((prev) => ({ ...prev, price: event.target.value }))
                        }
                        placeholder="营销路线可填"
                      />
                    </Field>
                    <Field label="卖点" className="span-2">
                      <textarea
                        value={videoForm.storeAdvantages}
                        onChange={(event) =>
                          setVideoForm((prev) => ({ ...prev, storeAdvantages: event.target.value }))
                        }
                        placeholder="1000平场地 / 百台进口器械 / 免费淋浴"
                      />
                    </Field>
                    <Field label="人群">
                      <input
                        value={videoForm.targetAudience}
                        onChange={(event) =>
                          setVideoForm((prev) => ({ ...prev, targetAudience: event.target.value }))
                        }
                        placeholder="附近上班族 / 新手减脂"
                      />
                    </Field>
                    <Field label="补充">
                      <textarea
                        value={videoForm.extraNotes}
                        onChange={(event) =>
                          setVideoForm((prev) => ({ ...prev, extraNotes: event.target.value }))
                        }
                        placeholder="口语化 / 多场景 / 轻一点"
                      />
                    </Field>
                    <Field label="参考" className="span-2">
                      <textarea
                        value={videoForm.sourceNotes}
                        onChange={(event) =>
                          setVideoForm((prev) => ({ ...prev, sourceNotes: event.target.value }))
                        }
                        placeholder="飞书摘要、账号观察、口播方向"
                      />
                    </Field>
                  </div>
                ) : null}

                {activeSkill === "zhibo-huashu" ? (
                  <div className="form-grid">
                    <Field label="模式">
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
                    <Field label="目标">
                      <input
                        value={liveForm.goal}
                        onChange={(event) =>
                          setLiveForm((prev) => ({ ...prev, goal: event.target.value }))
                        }
                        placeholder="成交 / 核销 / 逼单"
                      />
                    </Field>
                    <Field label="位置">
                      <input
                        value={liveForm.location}
                        onChange={(event) =>
                          setLiveForm((prev) => ({ ...prev, location: event.target.value }))
                        }
                        placeholder="南京新街口三楼"
                      />
                    </Field>
                    <Field label="主题">
                      <input
                        value={liveForm.campaignTheme}
                        onChange={(event) =>
                          setLiveForm((prev) => ({ ...prev, campaignTheme: event.target.value }))
                        }
                        placeholder="新店预售"
                      />
                    </Field>
                    <Field label="优势" className="span-2">
                      <textarea
                        value={liveForm.storeAdvantages}
                        onChange={(event) =>
                          setLiveForm((prev) => ({ ...prev, storeAdvantages: event.target.value }))
                        }
                        placeholder="1000平场地 / 5米挑高 / 百台进口器械"
                      />
                    </Field>
                    <Field label="团单" className="span-2">
                      <textarea
                        value={liveForm.offerContent}
                        onChange={(event) =>
                          setLiveForm((prev) => ({ ...prev, offerContent: event.target.value }))
                        }
                        placeholder="99元健身月卡 + 核心权益"
                      />
                    </Field>
                    <Field label="人群">
                      <input
                        value={liveForm.targetAudience}
                        onChange={(event) =>
                          setLiveForm((prev) => ({ ...prev, targetAudience: event.target.value }))
                        }
                        placeholder="附近想办月卡的新手"
                      />
                    </Field>
                    <Field label="补充">
                      <textarea
                        value={liveForm.extraNotes}
                        onChange={(event) =>
                          setLiveForm((prev) => ({ ...prev, extraNotes: event.target.value }))
                        }
                        placeholder="逼单更强 / 7天内核销送礼"
                      />
                    </Field>
                    <Field label="现有话术" className="span-2">
                      <textarea
                        value={liveForm.currentScript}
                        onChange={(event) =>
                          setLiveForm((prev) => ({ ...prev, currentScript: event.target.value }))
                        }
                        placeholder="优化模式可直接贴原稿"
                      />
                    </Field>
                  </div>
                ) : null}
              </div>

              <div className="panel-actionbar">
                <div className="action-meta">
                  <span className="action-label">策略</span>
                  <strong>{activeMeta.provider}</strong>
                </div>
                <button type="button" className="submit-button" onClick={submit} disabled={loading}>
                  {loading ? "生成中…" : activeMeta.submitText}
                </button>
              </div>
            </div>

            <div className="panel output-panel">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">Output</span>
                  <h3>结果</h3>
                </div>
                <span className="panel-chip ghost">{resultBadge}</span>
              </div>

              <div className={`result-scroll${!error && !result.type ? " empty" : ""}`}>
                {error ? <p className="error-text">{error}</p> : null}

                {!error && !result.type ? (
                  <div className="result-placeholder">
                    <strong>{activeMeta.emptyTitle}</strong>
                    <p>{activeMeta.emptyText}</p>
                  </div>
                ) : null}

                {result.note ? (
                  <div className="result-note-card">
                    <p>{result.note}</p>
                    {result.actions?.length ? (
                      <ul className="result-actions">
                        {result.actions.map((action) => (
                          <li key={action}>{action}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
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
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
