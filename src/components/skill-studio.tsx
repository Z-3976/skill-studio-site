"use client";

import { useMemo, useState } from "react";
import { skillCards, workflowSteps, type SkillId } from "@/lib/site-data";
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
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) => (
  <label className="field">
    <span className="field-label">{label}</span>
    {children}
    {hint ? <span className="field-hint">{hint}</span> : null}
  </label>
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
    <main className="page-shell">
      <div className="backdrop-grid" />
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">CODEx SKILL STUDIO</div>
          <h1>把三套增长技能做成一个真正能开工的网站。</h1>
          <p>
            同一套站点里，直接切换产品头图、短视频脚本、直播话术三个工作台。
            视觉任务能生图就出图，不能生图就给你最终提示词；文本任务则尽量直接输出可上线版本。
          </p>
          <div className="hero-pills">
            <span>门店增长</span>
            <span>本地生活</span>
            <span>健身行业</span>
          </div>
        </div>
        <div className="hero-panel">
          <div className="hero-card large">
            <span>{activeCard.index}</span>
            <strong>{activeCard.title}</strong>
            <p>{activeCard.blurb}</p>
          </div>
          <div className="hero-card stack">
            {workflowSteps.map((step) => (
              <div key={step.title}>
                <strong>{step.title}</strong>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="skill-selector">
        {skillCards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`skill-tile ${activeSkill === card.id ? "active" : ""}`}
            onClick={() => setActiveSkill(card.id)}
          >
            <span className="skill-index">{card.index}</span>
            <div className="skill-text">
              <p>{card.kicker}</p>
              <h2>{card.title}</h2>
              <span>{card.blurb}</span>
            </div>
            <div className="skill-tags">
              {card.tags.map((tag) => (
                <em key={tag}>{tag}</em>
              ))}
            </div>
          </button>
        ))}
      </section>

      <section className="studio-shell">
        <div className="studio-form">
          <div className="panel-head">
            <span>Input</span>
            <h3>{activeCard.title}工作台</h3>
          </div>

          {activeSkill === "chanping-toutu" ? (
            <>
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
              <Field label="产品权益">
                <textarea
                  value={visualForm.benefits}
                  onChange={(event) =>
                    setVisualForm((prev) => ({ ...prev, benefits: event.target.value }))
                  }
                  placeholder="每条权益一行，例如：免费淋浴、免费停车、巡场教练、体测"
                />
              </Field>
              <Field label="主题色" hint="建议填写颜色名、HEX 或一句描述。">
                <input
                  value={visualForm.themeColor}
                  onChange={(event) =>
                    setVisualForm((prev) => ({ ...prev, themeColor: event.target.value }))
                  }
                  placeholder="例如：薄荷青 #69d7d1"
                />
              </Field>
              <Field label="Logo 图片" hint="支持上传门店 Logo，作为识别和风格锚点。">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async (event) => {
                    const assets = await readFiles(event.target.files);
                    setVisualForm((prev) => ({ ...prev, logoAssets: assets }));
                  }}
                />
              </Field>
              <Field label="参考样板图" hint="可选；上传后会优先跟随版式和质感。">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async (event) => {
                    const assets = await readFiles(event.target.files);
                    setVisualForm((prev) => ({ ...prev, referenceAssets: assets }));
                  }}
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
            </>
          ) : null}

          {activeSkill === "duanshipin-moban" ? (
            <>
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
              <Field label="门店优势">
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
              <Field label="参考资料">
                <textarea
                  value={videoForm.sourceNotes}
                  onChange={(event) =>
                    setVideoForm((prev) => ({ ...prev, sourceNotes: event.target.value }))
                  }
                  placeholder="可粘贴飞书文档摘要、账号风格、视频观察结论"
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
            </>
          ) : null}

          {activeSkill === "zhibo-huashu" ? (
            <>
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
              <Field label="门店优势">
                <textarea
                  value={liveForm.storeAdvantages}
                  onChange={(event) =>
                    setLiveForm((prev) => ({ ...prev, storeAdvantages: event.target.value }))
                  }
                  placeholder="例如：1000平场地、5米挑高、百台进口器械、免费淋浴"
                />
              </Field>
              <Field label="团单内容">
                <textarea
                  value={liveForm.offerContent}
                  onChange={(event) =>
                    setLiveForm((prev) => ({ ...prev, offerContent: event.target.value }))
                  }
                  placeholder="例如：99元健身月卡，价值259元月卡一张，免费停车、体测、巡场教练"
                />
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
              <Field label="适合人群">
                <input
                  value={liveForm.targetAudience}
                  onChange={(event) =>
                    setLiveForm((prev) => ({ ...prev, targetAudience: event.target.value }))
                  }
                  placeholder="例如：附近想办月卡的新手用户"
                />
              </Field>
              <Field label="已有话术" hint="优化模式时建议粘贴原稿。">
                <textarea
                  value={liveForm.currentScript}
                  onChange={(event) =>
                    setLiveForm((prev) => ({ ...prev, currentScript: event.target.value }))
                  }
                  placeholder="把现有话术贴进来，我会按成交流程重组"
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
            </>
          ) : null}

          <button type="button" className="submit-button" onClick={submit} disabled={loading}>
            {loading ? "生成中..." : "开始生成"}
          </button>
        </div>

        <div className="studio-output">
          <div className="panel-head">
            <span>Output</span>
            <h3>生成结果</h3>
          </div>
          <div className="result-card">
            {error ? <p className="error-text">{error}</p> : null}
            {!error && !result.type ? (
              <div className="result-placeholder">
                <strong>{activeCard.title}</strong>
                <p>
                  这里会显示最终结果。视觉任务会优先出图；短视频和直播任务会直接输出可继续修改的成稿。
                </p>
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
    </main>
  );
}
