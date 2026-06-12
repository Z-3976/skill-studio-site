"use client";

import { useMemo, useState } from "react";
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
  children: React.ReactNode;
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

  const submitHint = useMemo(() => {
    if (activeSkill === "chanping-toutu") {
      return "Logo、权益和主题色尽量一次写全。桌面端会优先在一屏里完成填写和出图。";
    }

    if (activeSkill === "duanshipin-moban") {
      return "先选路线，再补产品、人群和门店优势，结果会更接近可直接拍摄的成稿。";
    }

    return "把门店优势、团单内容和补充要求写清楚，生成的话术会更顺着成交流程走。";
  }, [activeSkill]);

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
      <section className="workspace">
        <header className="workspace-header">
          <div className="workspace-brand">
            <div className="brand-mark">S</div>
            <div>
              <p className="brand-kicker">Skill Studio</p>
              <h1>简单一点，直接开工。</h1>
              <p className="brand-copy">像 ChatGPT 一样干净，但保留你三个技能的完整能力。</p>
            </div>
          </div>
          <div className="workspace-summary">
            <span className="summary-pill">3 个技能</span>
            <span className="summary-pill">图片 + 文案</span>
            <span className="summary-pill">一屏工作台</span>
          </div>
        </header>

        <nav className="skill-tabs" aria-label="技能切换">
          {skillCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className={`skill-tab${activeSkill === card.id ? " active" : ""}`}
              onClick={() => setActiveSkill(card.id)}
            >
              <strong className="skill-tab-title">{card.title}</strong>
              <span className="skill-tab-meta">{card.kicker}</span>
            </button>
          ))}
        </nav>

        <section className="active-strip">
          <div>
            <strong>{activeCard.title}</strong>
            <p>{activeCard.blurb}</p>
          </div>
          <div className="tag-row">
            {activeCard.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </section>

        <section className="workspace-body">
          <div className="panel input-panel">
            <div className="panel-heading">
              <div>
                <span>输入信息</span>
                <h2>按需填写，直接生成</h2>
              </div>
              <p>保留必要字段，减少干扰。桌面端优先控制在一个工作视图里完成。</p>
            </div>

            <div className="form-sheet">
              {activeSkill === "chanping-toutu" ? (
                <div className="form-grid">
                  <Field label="设计类型">
                    <select
                      value={visualForm.designType}
                      onChange={(event) =>
                        setVisualForm((prev) => ({ ...prev, designType: event.target.value }))
                      }
                    >
                      {["产品头图", "团购头图", "套餐图", "A4 KT板", "A3 KT板", "健身月卡", "私教周卡", "门店宣传图"].map(
                        (option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                  <Field label="门店名称">
                    <input
                      value={visualForm.storeName}
                      onChange={(event) =>
                        setVisualForm((prev) => ({ ...prev, storeName: event.target.value }))
                      }
                      placeholder="例如：CC GYM 新街口店"
                    />
                  </Field>
                  <Field label="产品名称">
                    <input
                      value={visualForm.productName}
                      onChange={(event) =>
                        setVisualForm((prev) => ({ ...prev, productName: event.target.value }))
                      }
                      placeholder="例如：99元健身月卡"
                    />
                  </Field>
                  <Field label="产品价格">
                    <input
                      value={visualForm.price}
                      onChange={(event) =>
                        setVisualForm((prev) => ({ ...prev, price: event.target.value }))
                      }
                      placeholder="例如：原价259，现价99"
                    />
                  </Field>
                  <Field label="产品权益" className="span-2">
                    <textarea
                      value={visualForm.benefits}
                      onChange={(event) =>
                        setVisualForm((prev) => ({ ...prev, benefits: event.target.value }))
                      }
                      placeholder="每条权益一行，例如：免费淋浴、免费停车、巡场教练、体测"
                    />
                  </Field>
                  <Field label="主题色">
                    <input
                      value={visualForm.themeColor}
                      onChange={(event) =>
                        setVisualForm((prev) => ({ ...prev, themeColor: event.target.value }))
                      }
                      placeholder="例如：薄荷青 #69d7d1"
                    />
                  </Field>
                  <Field label="补充要求">
                    <textarea
                      value={visualForm.extraNotes}
                      onChange={(event) =>
                        setVisualForm((prev) => ({ ...prev, extraNotes: event.target.value }))
                      }
                      placeholder="例如：偏高级、少小字、适合抖音团购头图"
                    />
                  </Field>
                  <Field label="Logo 图片" hint="支持多张图片。" className="span-2">
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
                  <Field label="参考样板图" hint="可选，风格会优先跟随样板图。" className="span-2">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async (event) => {
                        const assets = await readFiles(event.target.files);
                        setVisualForm((prev) => ({ ...prev, referenceAssets: assets }));
                      }}
                    />
                    <UploadSummary
                      assets={visualForm.referenceAssets}
                      emptyLabel="还没有上传参考样板图"
                    />
                  </Field>
                </div>
              ) : null}

              {activeSkill === "duanshipin-moban" ? (
                <div className="form-grid">
                  <Field label="脚本路线">
                    <select
                      value={videoForm.route}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, route: event.target.value }))
                      }
                    >
                      {["营销短视频", "官方轻IP（3km大众熟人）", "素人氛围号", "预热视频 / 核销视频 / 引流视频"].map(
                        (option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                  <Field label="视频目标">
                    <input
                      value={videoForm.goal}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, goal: event.target.value }))
                      }
                      placeholder="例如：转化下单、建立信任、活动预热"
                    />
                  </Field>
                  <Field label="产品名称">
                    <input
                      value={videoForm.productName}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, productName: event.target.value }))
                      }
                      placeholder="例如：99元健身月卡"
                    />
                  </Field>
                  <Field label="价格信息">
                    <input
                      value={videoForm.price}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, price: event.target.value }))
                      }
                      placeholder="营销路线可写价格，轻IP默认可留空"
                    />
                  </Field>
                  <Field label="门店优势" className="span-2">
                    <textarea
                      value={videoForm.storeAdvantages}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, storeAdvantages: event.target.value }))
                      }
                      placeholder="例如：1000平场地、百台进口器械、免费淋浴、免费停车"
                    />
                  </Field>
                  <Field label="目标人群">
                    <input
                      value={videoForm.targetAudience}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, targetAudience: event.target.value }))
                      }
                      placeholder="例如：附近3公里上班族、新手减脂用户"
                    />
                  </Field>
                  <Field label="补充要求">
                    <textarea
                      value={videoForm.extraNotes}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, extraNotes: event.target.value }))
                      }
                      placeholder="例如：多场景拍摄、口语化、轻一点，不要太像硬广"
                    />
                  </Field>
                  <Field label="参考资料" className="span-2">
                    <textarea
                      value={videoForm.sourceNotes}
                      onChange={(event) =>
                        setVideoForm((prev) => ({ ...prev, sourceNotes: event.target.value }))
                      }
                      placeholder="可粘贴飞书摘要、账号风格、视频观察结论"
                    />
                  </Field>
                </div>
              ) : null}

              {activeSkill === "zhibo-huashu" ? (
                <div className="form-grid">
                  <Field label="任务模式">
                    <select
                      value={liveForm.mode}
                      onChange={(event) =>
                        setLiveForm((prev) => ({ ...prev, mode: event.target.value }))
                      }
                    >
                      {["生成模式", "优化模式"].map((option) => (
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
                      placeholder="例如：成交转化、核销推进"
                    />
                  </Field>
                  <Field label="门店位置">
                    <input
                      value={liveForm.location}
                      onChange={(event) =>
                        setLiveForm((prev) => ({ ...prev, location: event.target.value }))
                      }
                      placeholder="例如：南京新街口三楼"
                    />
                  </Field>
                  <Field label="活动主题">
                    <input
                      value={liveForm.campaignTheme}
                      onChange={(event) =>
                        setLiveForm((prev) => ({ ...prev, campaignTheme: event.target.value }))
                      }
                      placeholder="例如：新店预售"
                    />
                  </Field>
                  <Field label="门店优势" className="span-2">
                    <textarea
                      value={liveForm.storeAdvantages}
                      onChange={(event) =>
                        setLiveForm((prev) => ({ ...prev, storeAdvantages: event.target.value }))
                      }
                      placeholder="例如：1000平场地、5米挑高、百台进口器械、免费淋浴"
                    />
                  </Field>
                  <Field label="团单内容" className="span-2">
                    <textarea
                      value={liveForm.offerContent}
                      onChange={(event) =>
                        setLiveForm((prev) => ({ ...prev, offerContent: event.target.value }))
                      }
                      placeholder="例如：99元健身月卡，价值259元月卡一张，免费停车、体测、巡场教练"
                    />
                  </Field>
                  <Field label="适合人群">
                    <input
                      value={liveForm.targetAudience}
                      onChange={(event) =>
                        setLiveForm((prev) => ({ ...prev, targetAudience: event.target.value }))
                      }
                      placeholder="例如：附近想办月卡的新手用户"
                    />
                  </Field>
                  <Field label="补充要求">
                    <textarea
                      value={liveForm.extraNotes}
                      onChange={(event) =>
                        setLiveForm((prev) => ({ ...prev, extraNotes: event.target.value }))
                      }
                      placeholder="例如：逼单要强一点，核销加7天内送礼提醒"
                    />
                  </Field>
                  <Field label="已有话术" hint="优化模式时建议粘贴原稿。" className="span-2">
                    <textarea
                      value={liveForm.currentScript}
                      onChange={(event) =>
                        setLiveForm((prev) => ({ ...prev, currentScript: event.target.value }))
                      }
                      placeholder="把现有话术贴进来，我会按成交流程重组"
                    />
                  </Field>
                </div>
              ) : null}
            </div>

            <div className="panel-footer">
              <p>{submitHint}</p>
              <button type="button" className="submit-button" onClick={submit} disabled={loading}>
                {loading ? "生成中..." : "开始生成"}
              </button>
            </div>
          </div>

          <div className="panel result-panel">
            <div className="panel-heading">
              <div>
                <span>生成结果</span>
                <h2>{activeCard.title}输出区</h2>
              </div>
              <p>尽量像 ChatGPT 一样清楚直接，优先给你可继续用的结果。</p>
            </div>

            <div className={`result-surface${!error && !result.type ? " empty" : ""}`}>
              {error ? <p className="error-text">{error}</p> : null}
              {!error && !result.type ? (
                <div className="result-placeholder">
                  <strong>还没有生成内容</strong>
                  <p>填写左侧信息后点击“开始生成”，结果会直接出现在这里。</p>
                </div>
              ) : null}
              {result.note ? (
                <div className="result-guidance">
                  <p className="result-note">{result.note}</p>
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
    </main>
  );
}
