import type { LocalFallbackResult, PromptConfig } from "./skill-prompts.types";
import type {
  LiveForm,
  ResultMeta,
  StudioPayload,
  UploadAsset,
  VisualForm,
  VideoForm,
  XiaohongshuForm,
} from "@/lib/studio-types";

export type { LocalFallbackResult, PromptConfig } from "./skill-prompts.types";
export type { UploadAsset } from "@/lib/studio-types";
export type { StudioPayload } from "@/lib/studio-types";

const VISUAL_SYSTEM = `
你是健身房与本地生活商业视觉设计师。
你的任务是把用户提供的 Logo、产品信息、主题色、参考样板图整理成最终中文生图提示词。
只输出最终可直接用于图片模型的中文提示词，不要解释过程。

必须遵守：
1. 产品头图、团购头图、套餐图、健身月卡、私教周卡默认按 4:3 横版。
2. 中间核心内容要控制在 1:1 安全区，避免裁切。
3. A4 / A3 KT 板按竖版线下物料逻辑排版。
4. 用户给了主题色，就把它当成强约束，只允许同色系明暗、渐变和材质延展，不要明显跑色。
5. Logo 放上方或视觉核心区，主标题大字突出，重点突出套餐名、价格、权益。
6. 少小字，整体要高级、清晰、有商业感，适合抖音团购、本地生活、健身房宣传。
`;

const XHS_VISUAL_SYSTEM = `
你是小红书本地生活内容视觉设计师。
你的任务是整理出小红书封面图的最终中文生图提示词。
只输出最终可直接用于图片模型的中文提示词，不要解释过程。

必须遵守：
1. 默认 3:4 竖版封面图。
2. 主标题落在中上区域，避开顶部和底部 UI 遮挡区。
3. 字少、字大、对比强，一眼能看懂。
4. 用户给了主题色时，保持大体色差不变。
5. 若用户给了 Logo，只做弱品牌露出，不做传统海报式大 Logo。
6. 团购转化型可突出价格数字；轻 IP / 探店种草型不要做成强促销海报。
7. 整体更像高点击封面，不像直播预告板或 KT 板。
`;

const VIDEO_SYSTEM = `
你是抖音本地生活与健身行业短视频脚本策划。
输出必须接近可直接拍摄的成片脚本。

必须遵守：
1. 严格遵守用户指定的脚本路线，不要串路线。
2. 营销短视频允许价格拆解、权益打包、转化引导、库存和时效提醒。
3. 官方轻IP（3km 大众熟人）禁止价格、逼单、库存不多、点链接下单等硬营销表达。
4. 素人氛围号重场景、情绪、生活感，不要写成硬广。
5. 默认输出多场景拍摄建议。
6. 口语化、真实、有门店感，不像通知，也不像宣传册。
7. 开头优先给出更容易停留的钩子。
`;

const LIVE_SYSTEM = `
你是抖音本地生活直播成交策划。
请生成可直接复用的直播话术。

固定结构必须是：
开场 -> 门店优势 -> 痛点对比 -> 团单三拆 -> 逼单 -> 保障 -> 核销

必须遵守：
1. 团单三拆优先包含原价对比、日均拆分、权益打包。
2. 逼单先讲时间，再讲数量，再给动作。
3. 保障必须放在逼单之后。
4. 核销必须单独讲清楚，可包含 7 天内核销送小礼品等动作。
5. 整体短句化、口语化，方便主播直接复述。
`;

const XHS_NOTE_SYSTEM = `
你是小红书健身房本地生活内容策划。
请根据门店和产品信息，生成更像真实小红书正文的内容，而不是抖音口播或直播话术。

必须遵守：
1. 严格按用户指定的笔记路线写作。
2. 团购转化笔记允许价格、权益、适合人群、到店动作。
3. 探店种草笔记强调环境、体验、真实感，弱营销。
4. 轻IP日常笔记使用主理人、教练、员工口吻，不硬卖。
5. 干货清单笔记更像建议、避坑、入门清单，结构清晰。
6. 标题更像小红书标题，不要像抖音封面字。
7. 正文要像用户会发出的笔记，不要像直播话术。
8. 输出固定结构：笔记路线、标题3版、开头钩子、正文成稿、分段小标题、结尾互动句、标签建议、封面文案。
`;

const TEXT_REVIEW_SYSTEM = `
你是中文内容复核编辑。
你的任务不是重写风格，而是把已有草稿校正成最终可用版本。
只输出修正后的最终版本，不要解释。
`;

const FACT_ONLY_RULE =
  "Only use facts explicitly provided by the user. Do not invent facilities, prices, coach services, gifts, addresses, sales numbers, brand assets, or comparison details.";

const REVIEW_FACT_ONLY_RULE =
  "Delete any invented details and keep only facts that were explicitly provided by the user or already present in the request.";

const field = (label: string, value: string | boolean | UploadAsset[] | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return `${label}：未提供`;
  }

  if (typeof value === "boolean") {
    return `${label}：${value ? "是" : "否"}`;
  }

  if (Array.isArray(value)) {
    return value.length ? `${label}：${value.map((item) => item.name).join("、")}` : `${label}：未提供`;
  }

  return `${label}：${value}`;
};

const asText = (value: string | boolean | UploadAsset[] | null | undefined) =>
  typeof value === "string" ? value.trim() : "";

const asList = (value: string | boolean | UploadAsset[] | null | undefined) =>
  asText(value)
    .split(/[\r\n,，、;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const isKtLayout = (designType: string) => designType.includes("KT");

export const isImagePayload = (payload: StudioPayload) =>
  payload.skill === "chanping-toutu" ||
  (payload.skill === "xiaohongshu-biji" && payload.form.outputType === "小红书笔记图");

const buildVisualPrompt = (form: VisualForm): PromptConfig => {
  const summary = [
    field("设计类型", form.designType),
    field("门店名称", form.storeName),
    field("产品名称", form.productName),
    field("价格信息", form.price),
    field("产品权益", form.benefits),
    field("主题色", form.themeColor),
    field("补充要求", form.extraNotes),
    field("Logo 素材", form.logoAssets),
    field("参考样图", form.referenceAssets),
  ].join("\n");

  return {
    kind: "image",
    systemPrompt: VISUAL_SYSTEM,
    userPrompt: `
请根据下面信息，整理为最终中文生图提示词：
${summary}

输出要求：
1. 若设计类型是产品头图、团购头图、套餐图、健身月卡、私教周卡，按 4:3 横版组织画面，中间 1:1 安全区承载核心信息。
2. 若设计类型是 A4 / A3 KT 板或门店宣传图，按竖版线下物料逻辑组织内容。
3. 若上传了参考样图，继承它的风格、材质、版式和光影倾向，但内容必须准确服务当前产品。
4. 若上传了 Logo，请明确要求保留 Logo 结构特征，并放在上方或视觉核心区。
5. 只输出最终中文生图提示词。
`.trim() + `\nFact rule: ${FACT_ONLY_RULE}`,
    imageSize: isKtLayout(form.designType) ? "1024x1536" : "1536x1024",
    successNote: isKtLayout(form.designType)
      ? "已按竖版物料逻辑完成生成，并尝试保存到桌面。"
      : "已按 4:3 头图和中间 1:1 安全区完成生成，并尝试保存到桌面。",
  };
};

const buildVideoPrompt = (form: VideoForm): PromptConfig => ({
  kind: "text",
  systemPrompt: VIDEO_SYSTEM,
  userPrompt: `
请生成 1 条可直接拍摄的短视频脚本：
${field("脚本路线", form.route)}
${field("视频目标", form.goal)}
${field("产品名称", form.productName)}
${field("价格信息", form.price)}
${field("门店卖点", form.storeAdvantages)}
${field("目标人群", form.targetAudience)}
${field("参考资料", form.sourceNotes)}
${field("补充要求", form.extraNotes)}

默认输出结构：
- 路线
- 标题
- 前3秒钩子A
- 前3秒钩子B
- 前3秒钩子C
- 完整口播
- 分镜建议
- 多场景拍摄
- 屏幕字幕
- 结尾引导
- 封面文案
`.trim() + `\nFact rule: ${FACT_ONLY_RULE}`,
  reviewSystemPrompt: TEXT_REVIEW_SYSTEM,
  buildReviewUserPrompt: (draft) => `
请把下面这版短视频草稿复核成最终版：
${draft}

复核要求：
1. 保持原路线，不要串到其他路线。
2. 若是营销短视频，可以保留价格拆解、原价现价对比、权益打包和下单引导。
3. 若是轻IP、3km 大众熟人或素人氛围号，删掉硬营销、库存、逼单、点链接等表达。
4. 开头钩子要更容易停留，但不要油腻。
5. 调整成更像真实门店会拍、会说的话。
6. 只输出最终版本。
`.trim() + `\nFact rule: ${REVIEW_FACT_ONLY_RULE}`,
});

const buildLivePrompt = (form: LiveForm): PromptConfig => ({
  kind: "text",
  systemPrompt: LIVE_SYSTEM,
  userPrompt: `
请生成或优化一版直播话术：
${field("任务模式", form.mode)}
${field("门店位置", form.location)}
${field("活动主题", form.campaignTheme)}
${field("门店优势", form.storeAdvantages)}
${field("团单内容", form.offerContent)}
${field("直播目标", form.goal)}
${field("适合人群", form.targetAudience)}
${field("已有话术", form.currentScript)}
${field("补充要求", form.extraNotes)}

只输出最终成稿，结构严格保持：
开场 -> 门店优势 -> 痛点对比 -> 团单三拆 -> 逼单 -> 保障 -> 核销
`.trim() + `\nFact rule: ${FACT_ONLY_RULE}`,
  reviewSystemPrompt: TEXT_REVIEW_SYSTEM,
  buildReviewUserPrompt: (draft) => `
请把下面这版直播话术复核成更顺口、成交逻辑更清楚的最终版：
${draft}

复核要求：
1. 固定顺序必须是开场、门店优势、痛点对比、团单三拆、逼单、保障、核销。
2. 逼单放在保障前面。
3. 团单三拆优先保留原价对比、日均拆分、权益打包。
4. 核销要独立讲清楚。
5. 整体更像主播现场说的话。
6. 只输出最终版本。
`.trim() + `\nFact rule: ${REVIEW_FACT_ONLY_RULE}`,
});

const buildXhsNotePrompt = (form: XiaohongshuForm): PromptConfig => ({
  kind: "text",
  systemPrompt: XHS_NOTE_SYSTEM,
  userPrompt: `
请生成 1 篇适合健身房本地生活的小红书笔记：
${field("输出类型", form.outputType)}
${field("笔记路线", form.route)}
${field("笔记目的", form.goal)}
${field("门店名称", form.storeName)}
${field("门店位置", form.location)}
${field("产品或主题", form.productName)}
${field("价格信息", form.price)}
${field("产品权益", form.benefits)}
${field("门店卖点", form.storeHighlights)}
${field("目标人群", form.targetAudience)}
${field("参考风格", form.referenceStyle)}
${field("主题色", form.themeColor)}
${field("语气要求", form.tone)}
${field("常用话题词", form.hashtags)}
${field("补充要求", form.extraNotes)}

标题生成要求：
1. 标题 3 版要明显不同，不要只是换几个词。
2. 标题更像小红书标题，可参考痛点、反差、体验、清单、提醒等不同切法。
3. 不要把标题写成抖音口播开头。

只按这个结构输出：
笔记路线：
标题1：
标题2：
标题3：
开头钩子：
正文成稿：
分段小标题：
1.
2.
3.
结尾互动句：
标签建议：
封面文案：
`.trim() + `\nFact rule: ${FACT_ONLY_RULE}`,
  reviewSystemPrompt: TEXT_REVIEW_SYSTEM,
  buildReviewUserPrompt: (draft) => `
请把下面这版小红书笔记复核成最终版：
${draft}

复核要求：
1. 检查是否跑偏成抖音口播或直播话术，如果有，改回小红书正文语气。
2. 团购转化笔记允许价格和到店动作；轻IP、探店种草、干货清单不要过度营销。
3. 保留真实门店感、本地生活感和健身房语境。
4. 标题要像小红书，不要像海报文案。
5. 结构保持不变，只输出最终版本。
`.trim() + `\nFact rule: ${REVIEW_FACT_ONLY_RULE}`,
});

const buildXhsVisualPrompt = (form: XiaohongshuForm): PromptConfig => {
  const summary = [
    field("输出类型", form.outputType),
    field("封面路线", form.route),
    field("笔记目的", form.goal),
    field("门店名称", form.storeName),
    field("门店位置", form.location),
    field("产品或主题", form.productName),
    field("价格信息", form.price),
    field("产品权益", form.benefits),
    field("门店卖点", form.storeHighlights),
    field("目标人群", form.targetAudience),
    field("参考风格", form.referenceStyle),
    field("主题色", form.themeColor),
    field("语气要求", form.tone),
    field("补充要求", form.extraNotes),
    field("Logo 素材", form.logoAssets),
    field("参考样图", form.referenceAssets),
  ].join("\n");

  return {
    kind: "image",
    systemPrompt: XHS_VISUAL_SYSTEM,
    userPrompt: `
请根据下面信息整理一版“小红书笔记图”的最终中文生图提示词：
${summary}

输出要求：
1. 默认 3:4 竖版封面图。
2. 主标题落在中上区域，避开小红书顶部和底部 UI 遮挡区。
3. 字少、字大、对比强。
4. 若是团购转化型，可让价格数字成为主钩子。
5. 若是轻 IP / 探店种草型，不要做强促销海报感。
6. 若给了 Logo，只做弱品牌露出。
7. 只输出最终中文生图提示词。
`.trim() + `\nFact rule: ${FACT_ONLY_RULE}`,
    imageSize: "1024x1536",
    successNote: "已按 3:4 小红书封面图逻辑完成生成，并尝试保存到桌面。",
  };
};

export const buildSkillInstructions = (payload: StudioPayload): PromptConfig => {
  switch (payload.skill) {
    case "chanping-toutu":
      return buildVisualPrompt(payload.form);
    case "duanshipin-moban":
      return buildVideoPrompt(payload.form);
    case "zhibo-huashu":
      return buildLivePrompt(payload.form);
    case "xiaohongshu-biji":
      return payload.form.outputType === "小红书笔记图"
        ? buildXhsVisualPrompt(payload.form)
        : buildXhsNotePrompt(payload.form);
    default:
      throw new Error("unsupported skill");
  }
};

export const buildUserSummary = (payload: StudioPayload) => {
  switch (payload.skill) {
    case "chanping-toutu":
      return [
        `设计类型：${payload.form.designType || "产品头图"}`,
        `门店：${payload.form.storeName || "未填写"}`,
        `产品：${payload.form.productName || "未填写"}`,
        `价格：${payload.form.price || "未填写"}`,
        `主题色：${payload.form.themeColor || "未填写"}`,
      ].join("\n");
    case "duanshipin-moban":
      return [
        `路线：${payload.form.route || "未填写"}`,
        `目标：${payload.form.goal || "未填写"}`,
        `产品：${payload.form.productName || "未填写"}`,
        `人群：${payload.form.targetAudience || "未填写"}`,
      ].join("\n");
    case "zhibo-huashu":
      return [
        `模式：${payload.form.mode || "未填写"}`,
        `主题：${payload.form.campaignTheme || "未填写"}`,
        `位置：${payload.form.location || "未填写"}`,
        `团单：${payload.form.offerContent || "未填写"}`,
      ].join("\n");
    case "xiaohongshu-biji":
      return [
        `输出：${payload.form.outputType || "小红书笔记"}`,
        `路线：${payload.form.route || "未填写"}`,
        `主题：${payload.form.productName || "未填写"}`,
        `目的：${payload.form.goal || "未填写"}`,
        `人群：${payload.form.targetAudience || "未填写"}`,
      ].join("\n");
    default:
      return "未识别的请求";
  }
};

const matchSingle = (text: string, pattern: RegExp) => {
  const match = text.match(pattern);
  return match?.[1]?.trim() || "";
};

export const extractResultMeta = (payload: StudioPayload, text: string): ResultMeta | undefined => {
  if (payload.skill !== "xiaohongshu-biji" || payload.form.outputType !== "小红书笔记") {
    return undefined;
  }

  const titles = [...text.matchAll(/^标题\s*[1-3]?\s*[：:]\s*(.+)$/gm)]
    .map((match) => match[1]?.trim())
    .filter(Boolean) as string[];

  const hashtags = [...text.matchAll(/#([^\s#]+)/g)].map((match) => `#${match[1]}`);
  const route = matchSingle(text, /^笔记路线[：:]\s*(.+)$/m);
  const coverCopy = matchSingle(text, /^封面文案[：:]\s*(.+)$/m);

  return {
    route,
    titles,
    coverCopy,
    hashtags,
    reviewSummary: "已按小红书正文语气和路线约束复核。",
  };
};

const buildVisualFallback = (form: VisualForm): LocalFallbackResult => {
  const benefitText = asList(form.benefits).join("、") || "核心权益清晰展示";
  const productName = form.productName || "门店主推产品";
  const themeColor = form.themeColor || "用户主题色";
  const layout = isKtLayout(form.designType)
    ? "按竖版线下物料排版，信息由上到下清晰分层"
    : "按 4:3 横版头图排版，中间 1:1 安全区承载核心信息";

  return {
    type: "prompt",
    note: "已返回最终生图提示词。",
    text: `最终生图提示词：为${form.storeName ? `${form.storeName}的` : ""}${form.designType || "产品头图"}制作一张高级商业宣传视觉，主内容为“${productName}”，重点突出价格“${form.price || "价格醒目展示"}”和权益“${benefitText}”。${layout}，Logo 放上方或视觉核心区，主标题大字突出，整体围绕“${themeColor}”展开，只允许同色系明暗、渐变和材质延展，不要明显跑色。画面质感高级、清晰、简洁，适合本地生活和健身房宣传。${form.extraNotes ? `补充要求：${form.extraNotes}。` : ""}`,
  };
};

const buildVideoFallback = (form: VideoForm): LocalFallbackResult => {
  const marketing = form.route.includes("营销");
  const hook = marketing
    ? "最近如果你正打算开始锻炼，这条内容先别划走。"
    : "最近在店里待了一会儿，我突然明白为什么有些人能把训练坚持下来。";

  return {
    type: "text",
    note: "当前模型不可用，已返回可直接改用的基础脚本。",
    text: `路线：${form.route || "营销短视频"}
标题：${form.productName || "门店主推内容"}这样拍，更容易让人停下来
前3秒钩子A：${hook}
前3秒钩子B：如果你最近也在看附近健身房，这条可以先看完。
前3秒钩子C：很多人不是练不下去，是没找到更容易坚持的地方。
完整口播：${hook} 这条内容围绕${form.productName || "门店主推内容"}展开，门店卖点是${form.storeAdvantages || "待补充"}，目标人群是${form.targetAudience || "附近潜在人群"}。${marketing && form.price ? `价格信息“${form.price}”可以拆解清楚，把价值感讲透，再自然收转化动作。` : "这条内容更适合用真实门店感和真实表达把用户留下来。"}

分镜建议：
1. 门头开场
2. 器械区特写
3. 教练或会员互动
4. 收尾镜头自然引导

多场景拍摄：
场景1：门店外景
场景2：器械区
场景3：互动区
场景4：结尾收口

屏幕字幕：真实门店 / 真实体验 / 真实训练
结尾引导：${marketing ? "看看链接还有没有，合适就先占个名额。" : "欢迎先来店里感受一下，再决定适不适合自己。"}
封面文案：${form.productName || "门店主推内容"}，别拍得太像广告`,
  };
};

const buildLiveFallback = (form: LiveForm): LocalFallbackResult => ({
  type: "text",
  note: "当前模型不可用，已返回可直接改用的基础话术。",
  text: `任务模式：${form.mode || "生成模式"}
直播目标：${form.goal || "成交转化"}

开场：
欢迎刚进来的朋友，门店就在${form.location || "门店位置待补充"}，今天这场直播重点讲${form.campaignTheme || "活动主题待补充"}。

门店优势：
我们这边核心优势是${form.storeAdvantages || "门店优势待补充"}。

痛点对比：
很多人不是不想练，而是场地、器械、停车、洗浴这些细节太影响体验。

团单三拆：
第一拆讲原价和活动价，第二拆讲日均成本，第三拆讲权益打包，把${form.offerContent || "团单内容"}讲明白。

逼单：
这类活动一般都有时间窗口，先讲时间，再讲数量，再给动作。

保障：
到店不乱收费，不会强制推销，有问题当场问。

核销：
拍下后尽快核销，若有 7 天内核销送礼这类动作，要单独讲清楚。`,
});

const buildXhsNoteFallback = (form: XiaohongshuForm): LocalFallbackResult => {
  const isConversion = form.route.includes("团购");
  const priceLine = isConversion && form.price ? `价格信息：${form.price}` : "这篇不主打价格，重点讲体验和门店感。";

  return {
    type: "text",
    note: "当前模型不可用，已返回可直接改用的基础笔记。",
    text: `笔记路线：${form.route || "探店种草笔记"}
标题1：最近试了这家健身房，我终于知道为什么有人能坚持下来
标题2：${form.productName || "这家健身房"}最打动我的，不只是器械
标题3：如果你最近在看附近健身房，这篇可以先看完
开头钩子：我最近去看了一家健身房，原本只是随便看看，结果有几个细节确实让我挺意外。
正文成稿：门店在${form.location || "本地商圈"}，主打的是${form.productName || "门店主推内容"}。先说结论，如果你最近正想找一家更容易坚持下来的健身房，这家确实有几个点挺加分。${priceLine} 门店卖点主要是${form.storeHighlights || "待补充"}，再加上${form.benefits || "相关权益"}，整体会更像一套完整体验，而不是单纯卖一张卡。
分段小标题：
1. 我先看中的是什么
2. 真正让我决定多了解一下的细节
3. 哪类人会更适合
结尾互动句：如果你最近也在看附近的健身房，可以把你最在意的点留言给我，我按真实体验继续写。
标签建议：#健身房 #本地生活 #健身月卡
封面文案：${form.productName || "健身房真实体验"}，到底值不值得去看`,
  };
};

const buildXhsImageFallback = (form: XiaohongshuForm): LocalFallbackResult => {
  const mainTheme = form.themeColor || "用户主题色";
  const imageDirection = form.route.includes("团购")
    ? "价格数字可以作为主视觉钩子"
    : "重点突出体验感、氛围感和主题标题";

  return {
    type: "prompt",
    note: "已返回最终生图提示词。",
    text: `最终生图提示词：为“小红书笔记图”制作一张 3:4 竖版封面，主题为“${form.productName || "健身房笔记封面"}”，笔记路线是“${form.route || "探店种草笔记"}”，门店核心卖点为“${form.storeHighlights || "待补充"}”，权益信息为“${form.benefits || "待补充"}”。主标题放在中上区域，避开顶部和底部 UI 遮挡区，字少、字大、对比强，${imageDirection}。主视觉围绕“${mainTheme}”展开，只允许同色系明暗、渐变和材质延展，不要明显跑色。若有 Logo，仅做弱品牌露出，不做传统海报式大 Logo。整体像小红书高点击封面，不像直播预告板。${form.extraNotes ? `补充要求：${form.extraNotes}。` : ""}`,
  };
};

export const buildLocalFallback = (payload: StudioPayload): LocalFallbackResult => {
  switch (payload.skill) {
    case "chanping-toutu":
      return buildVisualFallback(payload.form);
    case "duanshipin-moban":
      return buildVideoFallback(payload.form);
    case "zhibo-huashu":
      return buildLiveFallback(payload.form);
    case "xiaohongshu-biji":
      return payload.form.outputType === "小红书笔记图"
        ? buildXhsImageFallback(payload.form)
        : buildXhsNoteFallback(payload.form);
    default:
      throw new Error("unsupported skill");
  }
};
