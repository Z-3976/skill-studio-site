import type { LocalFallbackResult, PromptConfig } from "./skill-prompts.types";
import type { LiveForm, ResultMeta, StudioPayload, UploadAsset, VideoForm, VisualForm, XiaohongshuForm } from "@/lib/studio-types";

export type { LocalFallbackResult, PromptConfig } from "./skill-prompts.types";
export type { StudioPayload, UploadAsset } from "@/lib/studio-types";

const FACT_RULE =
  "只能使用用户已经明确提供的事实，不要虚构门店面积、器械数量、库存、退款规则、具体地址、具体时间、赠品或任何未确认信息。";

const REVIEW_RULE =
  "复核时删除所有编造内容，只保留用户明确提供或请求里已经存在的信息。";

const VISUAL_SYSTEM = `
你是健身房与本地生活商业视觉设计师。
你的任务不是解释设计思路，而是把用户提供的门店 Logo、产品名称、价格、权益、主题色、参考图整理成可直接执行的视觉生成方案。
必须遵守：
1. 产品头图、团购头图、套餐图、健身月卡、私教周卡默认按 4:3 横版处理，中间核心内容控制在 1:1 安全区。
2. A4 / A3 KT 板按线下竖版物料逻辑处理，但关键主信息仍要集中在安全区域。
3. 用户给了主题色，就把它当成强约束，只允许明暗、渐变和材质延展，不要明显跑色。
4. Logo 放上方或视觉核心区，保留原始结构和识别特征。
5. 主标题必须大，重点突出套餐名、价格、权益，少小字。
6. 画面主体必须是健身房真实语境：器械区、镜面墙、前台、训练空间、训练氛围，不要出现咖啡厅、家居、办公室、美妆店等无关场景。
7. 整体要高级、清晰、有商业感，适合抖音团购、本地生活和健身房宣传。
`;

const VIDEO_SYSTEM = `
你是抖音本地生活与健身行业短视频成片脚本生成器。
你必须直接输出可拍、可说、可剪、可发的完整脚本，不展示分析过程。
只允许四条路线：
1. 营销短视频
2. 种草短视频
3. 核销短视频
4. 引流直播间短视频

强边界：
1. 营销短视频允许讲价格、原价现价对比、按天拆解、99包什么、后半段下单引导。
2. 官方轻IP（3km 大众熟人）和素人氛围号都归到种草路线：不允许价格、不允许库存不多、不允许限时逼单、不允许左下角点链接下单、不允许硬营销。
3. 核销短视频重点是到店顾虑、核销流程、真实体验和降低门槛，不写成纯拉新成交视频。
4. 引流直播间短视频重点是把人导进直播间，不要在短视频里把成交细节一次说完。
5. 每一句都要能拍出来，分镜必须具体到场景、人物、景别、台词作用。
6. 优先真实门店感和多场景拍摄，不要空泛镜头。
`;

const LIVE_SYSTEM = `
你是健身房与本地生活直播成交话术生成器。
你要直接输出主播可以照着念的完整成交话术，不给提纲，不给分析。
固定顺序必须是：
开场 -> 门店优势 -> 痛点对比 -> 团单三拆 -> 逼单 -> 保障 -> 核销

强规则：
1. 开场必须同时包含福利、位置、需求。
2. 团单三拆必须同时包含价格对比、按天拆解、权益拆解。
3. 逼单必须同时有时间压力和数量压力，但不要凭空编库存数字。
4. 保障必须放在逼单后面，作用是托底成交。
5. 核销必须单独成段，默认可带“7天内核销有礼”，除非用户提供了更明确的规则。
6. 语言要口语化、节奏快、有成交感，像主播连续说话，不像培训文档。
`;

const XHS_NOTE_SYSTEM = `
你是健身房和本地生活场景的小红书内容策划。
你输出的是可直接发布的小红书笔记，不是抖音口播，也不是直播话术。
路线只允许：
1. 团购转化笔记：允许价格、权益、适合人群、到店动作
2. 探店种草笔记：强调环境、体验、真实感，弱营销
3. 轻IP日常笔记：门店主理人/教练/员工口吻，不硬卖
4. 干货清单笔记：适合训练建议、避坑、入门、常见问题

必须输出：
笔记路线
标题3版
开头钩子
正文成稿
分段小标题
结尾互动句
标签建议
封面文案

必须复核：
1. 不要写成抖音口播。
2. 不要写成直播成交话术。
3. 不要过度营销。
4. 要贴合健身房本地生活语境。
`;

const IMAGE_SKILL_TEXT = `
如果当前环境支持图片生成，就直接生成图片。
如果当前环境不支持图片生成，就只输出最终中文生图提示词，不要长篇解释。
`;

const TEXT_REVIEW_SYSTEM = `
你是最终成稿复核编辑。
你的任务是对已经生成的内容做一次静默复核，删除跑偏、过度营销、编造事实、结构错位和不符合路线的表达。
只输出修正后的最终版本，不要解释。
`;

const field = (label: string, value: string | UploadAsset[] | undefined) => {
  if (Array.isArray(value)) {
    return `${label}：${value.length ? value.map((item) => item.name).join("、") : "未提供"}`;
  }

  const clean = value?.trim();
  return `${label}：${clean || "未提供"}`;
};

const asList = (value: string) =>
  value
    .split(/[\n,，、;；]+/)
    .map((item) => item.trim().replace(/^\d+[.、\s]*/, ""))
    .filter(Boolean);

const allowedVisualText = (form: VisualForm | XiaohongshuForm) =>
  [
    form.storeName,
    form.productName,
    form.price,
    ...("benefits" in form ? asList(form.benefits) : []),
    ...("storeHighlights" in form ? asList(form.storeHighlights) : []),
  ]
    .filter(Boolean)
    .join("、");

const buildVisualPrompt = (form: VisualForm): PromptConfig => {
  const isKt = /KT/i.test(form.designType);

  return {
    kind: "image",
    systemPrompt: `${VISUAL_SYSTEM}\n${IMAGE_SKILL_TEXT}`,
    userPrompt: [
      field("设计类型", form.designType),
      field("门店名称", form.storeName),
      field("产品名称", form.productName),
      field("价格", form.price),
      field("产品权益", form.benefits),
      field("主题色", form.themeColor),
      field("补充要求", form.extraNotes),
      field("Logo素材", form.logoAssets),
      field("参考图", form.referenceAssets),
    ].join("\n"),
    imageSize: isKt ? "1024x1536" : "1536x1024",
    successNote: isKt
      ? "已按竖版 KT 物料逻辑生成，并完成安全区与健身场景自检。"
      : "已按 4:3 头图和中间 1:1 安全区生成，并完成主题色与健身场景自检。",
  };
};

const buildVideoPrompt = (form: VideoForm): PromptConfig => ({
  kind: "text",
  systemPrompt: VIDEO_SYSTEM,
  userPrompt: `
请根据下面的信息生成一条完整短视频脚本：
${field("脚本路线", form.route)}
${field("视频目标", form.goal)}
${field("产品名称", form.productName)}
${field("价格信息", form.price)}
${field("门店卖点", form.storeAdvantages)}
${field("目标人群", form.targetAudience)}
${field("参考资料", form.sourceNotes)}
${field("补充要求", form.extraNotes)}

固定输出结构：
1. 视频类型
2. 标题
3. 开头3秒钩子
4. 完整口播稿
5. 分镜脚本
6. 屏幕字幕文案
7. 左下角引导文案
8. 发布文案
9. 话题标签
10. 评论区引导
11. 拍摄执行提醒

补充要求：
1. 如果是营销短视频，要允许价格拆解，但转化引导放在后半段。
2. 如果是轻IP / 3km大众熟人 / 素人氛围号，必须去掉价格、库存、下单和强促销。
3. 如果是核销短视频，重点写到店和核销过程。
4. 如果是引流直播间短视频，重点把人导进直播间。
5. 每个分镜都要写清楚拍什么、谁出镜、景别、对应哪句台词、承担什么作用。
6. 优先真实健身房多场景拍摄。
7. ${FACT_RULE}
`.trim(),
  reviewSystemPrompt: TEXT_REVIEW_SYSTEM,
  buildReviewUserPrompt: (draft) => `
请把下面这版短视频脚本复核成最终版：
${draft}

复核重点：
1. 营销视频可以讲价格，但下单引导必须靠后。
2. 轻IP、3km大众熟人、素人氛围号必须去掉价格和硬营销。
3. 核销视频要像核销，不要像拉新成交。
4. 引流直播间视频要留钩子，不要一次讲完。
5. 口播要像真人说话，分镜要更可拍。
6. ${REVIEW_RULE}
`.trim(),
});

const buildLivePrompt = (form: LiveForm): PromptConfig => ({
  kind: "text",
  systemPrompt: LIVE_SYSTEM,
  userPrompt: `
请根据下面信息直接生成一整篇可在直播间照着念的完整话术：
${field("任务模式", form.mode)}
${field("门店位置", form.location)}
${field("活动主题", form.campaignTheme)}
${field("门店优势", form.storeAdvantages)}
${field("团单内容", form.offerContent)}
${field("直播目标", form.goal)}
${field("目标人群", form.targetAudience)}
${field("已有话术", form.currentScript)}
${field("补充要求", form.extraNotes)}

硬性要求：
1. 固定顺序必须是：开场 -> 门店优势 -> 痛点对比 -> 团单三拆 -> 逼单 -> 保障 -> 核销。
2. 团单三拆必须同时出现：价格对比、按天拆解、权益拆解。
3. 保障必须放在逼单之后。
4. 核销要单独成段，如果用户没给更明确规则，默认带 7天内核销有礼。
5. 每个标题下面都必须是主播能直接念的正文，不要只写提示词。
6. 语气要有成交节奏，但不要编造具体事实。
7. ${FACT_RULE}
`.trim(),
  reviewSystemPrompt: TEXT_REVIEW_SYSTEM,
  buildReviewUserPrompt: (draft) => `
请把下面这版直播话术复核成最终版：
${draft}

复核重点：
1. 顺序不能乱，尤其是逼单后再保障。
2. 团单三拆必须完整。
3. 保障要像托底成交，不要太软。
4. 核销要独立成段，并明确行动动作。
5. 整体要更口语化、更像主播连续说话。
6. ${REVIEW_RULE}
`.trim(),
});

const buildXhsNotePrompt = (form: XiaohongshuForm): PromptConfig => ({
  kind: "text",
  systemPrompt: XHS_NOTE_SYSTEM,
  userPrompt: `
请生成一篇适合健身房本地生活场景的小红书笔记：
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

固定输出结构：
笔记路线
标题1
标题2
标题3
开头钩子
正文成稿
分段小标题
结尾互动句
标签建议
封面文案

补充要求：
1. 团购转化笔记允许价格和权益。
2. 探店种草、轻IP日常、干货清单不要写成强促销。
3. 语言要更像小红书正文，不要像抖音口播。
4. ${FACT_RULE}
`.trim(),
  reviewSystemPrompt: TEXT_REVIEW_SYSTEM,
  buildReviewUserPrompt: (draft) => `
请把下面这版小红书笔记复核成最终版：
${draft}

复核重点：
1. 不要写成抖音口播。
2. 不要写成直播成交话术。
3. 团购路线允许价格，其他路线避免过度营销。
4. 保留健身房本地生活语境和真实门店感。
5. ${REVIEW_RULE}
`.trim(),
});

const buildXhsVisualPrompt = (form: XiaohongshuForm): PromptConfig => ({
  kind: "image",
  systemPrompt: `${VISUAL_SYSTEM}\n${XHS_NOTE_SYSTEM}\n${IMAGE_SKILL_TEXT}`,
  userPrompt: [
    field("输出类型", form.outputType),
    field("笔记路线", form.route),
    field("门店名称", form.storeName),
    field("门店位置", form.location),
    field("产品或主题", form.productName),
    field("价格信息", form.price),
    field("产品权益", form.benefits),
    field("门店卖点", form.storeHighlights),
    field("目标人群", form.targetAudience),
    field("参考风格", form.referenceStyle),
    field("主题色", form.themeColor),
    field("补充要求", form.extraNotes),
    field("Logo素材", form.logoAssets),
    field("参考图", form.referenceAssets),
  ].join("\n"),
    imageSize: "1024x1536",
    successNote: "已按 3:4 小红书封面逻辑生成，并完成主题色、标题区和健身场景自检。",
  });

export const buildSkillInstructions = (payload: StudioPayload): PromptConfig => {
  switch (payload.skill) {
    case "chanping-toutu":
      return buildVisualPrompt(payload.form);
    case "duanshipin-moban":
      return buildVideoPrompt(payload.form);
    case "zhibo-huashu":
      return buildLivePrompt(payload.form);
    case "xiaohongshu-biji":
      return buildXhsNotePrompt(payload.form);
    case "xiaohongshu-bijitu":
      return buildXhsVisualPrompt(payload.form);
  }
};

export const isImagePayload = (payload: StudioPayload) =>
  payload.skill === "chanping-toutu" || payload.skill === "xiaohongshu-bijitu";

export const buildUserSummary = (payload: StudioPayload) => {
  switch (payload.skill) {
    case "chanping-toutu":
      return [
        `设计：${payload.form.designType || "产品头图"}`,
        payload.form.storeName ? `门店：${payload.form.storeName}` : "",
        payload.form.productName ? `产品：${payload.form.productName}` : "",
        payload.form.price ? `价格：${payload.form.price}` : "",
        payload.form.themeColor ? `主题色：${payload.form.themeColor}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    case "duanshipin-moban":
      return [
        `路线：${payload.form.route || "营销短视频"}`,
        payload.form.goal ? `目标：${payload.form.goal}` : "",
        payload.form.productName ? `产品：${payload.form.productName}` : "",
        payload.form.targetAudience ? `人群：${payload.form.targetAudience}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    case "zhibo-huashu":
      return [
        `模式：${payload.form.mode || "生成模式"}`,
        payload.form.campaignTheme ? `主题：${payload.form.campaignTheme}` : "",
        payload.form.location ? `位置：${payload.form.location}` : "",
        payload.form.offerContent ? `团单：${payload.form.offerContent}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    case "xiaohongshu-biji":
      return [
        `路线：${payload.form.route || "探店种草笔记"}`,
        payload.form.productName ? `主题：${payload.form.productName}` : "",
        payload.form.goal ? `目的：${payload.form.goal}` : "",
        payload.form.targetAudience ? `人群：${payload.form.targetAudience}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    case "xiaohongshu-bijitu":
      return [
        `路线：${payload.form.route || "探店种草笔记"}`,
        payload.form.productName ? `主题：${payload.form.productName}` : "",
        payload.form.themeColor ? `主题色：${payload.form.themeColor}` : "",
      ]
        .filter(Boolean)
        .join("\n");
  }
};

const matchLine = (text: string, label: string) => {
  const pattern = new RegExp(`^${label}[：:]\\s*(.+)$`, "m");
  return text.match(pattern)?.[1]?.trim() || "";
};

export const extractResultMeta = (payload: StudioPayload, text: string): ResultMeta | undefined => {
  if (payload.skill !== "xiaohongshu-biji") {
    return undefined;
  }

  const titles = [...text.matchAll(/^标题[123]?[：:]\s*(.+)$/gm)]
    .map((match) => match[1]?.trim())
    .filter(Boolean) as string[];
  const hashtags = [...text.matchAll(/#([^\s#]+)/g)].map((match) => `#${match[1]}`);
  const route = matchLine(text, "笔记路线");
  const coverCopy = matchLine(text, "封面文案");

  return {
    route,
    titles,
    coverCopy,
    hashtags,
    reviewSummary: "已完成路线边界、小红书语气和真实性自检。",
  };
};

const buildVisualFallback = (form: VisualForm): LocalFallbackResult => {
  const isKt = /KT/i.test(form.designType);
  const points = asList(form.benefits);
  const safeArea = isKt ? "按竖版 KT 板逻辑排版" : "按 4:3 头图排版，中间 1:1 安全区承载主信息";

  return {
    type: "prompt",
    note: "当前环境未直接完成出图，已输出最终生图提示词。",
    text: `最终生图提示词：为${form.storeName || "该门店"}制作一张${form.designType || "产品头图"}，主标题是“${form.productName || "主推产品"}”，价格信息是“${form.price || "价格醒目展示"}”，核心权益包含“${points.join("、") || "主要权益清晰展示"}”。${safeArea}，Logo放上方或视觉核心区，主题色严格围绕“${form.themeColor || "用户主题色"}”展开，只允许同色系明暗、渐变和材质延展，不要明显跑色。画面主体必须是健身房训练空间、器械区、镜面墙、前台或真实训练氛围，不要出现咖啡厅、家居、办公室、美妆店等无关场景。整体要高级、清晰、有商业感，适合抖音团购、本地生活和健身房宣传。画面中仅允许出现这些中文文案：${allowedVisualText(form) || form.productName || "主推产品"}。不要额外编造价格、权益、电话、二维码、地址和品牌名。${form.extraNotes ? `补充要求：${form.extraNotes}。` : ""}`,
  };
};

const buildVideoFallback = (form: VideoForm): LocalFallbackResult => ({
  type: "text",
  note: "当前文本模型未稳定返回，已给你一版可直接改用的脚本底稿。",
  text: `1. 视频类型
${form.route || "营销短视频"}

2. 标题
${form.productName || "门店主推内容"}这样拍，更容易让人停下来

3. 开头3秒钩子
最近如果你也在看附近健身房，这条先别划走。

4. 完整口播稿
这条内容围绕${form.productName || "门店主推内容"}展开，重点讲清楚${form.storeAdvantages || "真实门店卖点"}。${form.route.includes("营销") && form.price ? `价格信息是${form.price}，可以重点做原价现价对比、按天拆解和权益打包，但下单引导要放后半段。` : ""}${form.route.includes("轻IP") || form.route.includes("素人") ? "整体语气要更像真实分享，不出现价格、库存、下单和硬促销。" : ""}${form.route.includes("核销") ? "重点讲到店流程、核销动作和真实体验，先消除顾虑，再促来到店。" : ""}${form.route.includes("引流") || form.route.includes("预热") ? "结尾把人导进直播间，不要把所有细节一次说完。" : ""}

5. 分镜脚本
镜头1：门头外景，中景，对应开头钩子，作用是先抓停留。
镜头2：器械区特写，近景，对应门店卖点，作用是建立真实感。
镜头3：教练或会员训练状态，中景，对应体验描述，作用是增强可信度。
镜头4：前台或训练动线，中景，对应补充说明，作用是降低陌生感。
镜头5：收尾镜头，近景，对应最后行动动作，作用是完成收口。

6. 屏幕字幕文案
真实门店
真实训练氛围
更容易坚持
适合附近人群
先看完再决定

7. 左下角引导文案
${form.route.includes("营销") ? "看一下左下角还有没有活动，合适就先锁一个名额。" : form.route.includes("引流") || form.route.includes("预热") ? "先进直播间，我把细节给你讲清楚。" : form.route.includes("核销") ? "已经下单的，别一直拖，安排时间来店里看看。" : "种草路线不放硬下单引导。"}

8. 发布文案
把${form.productName || "门店主推内容"}拍成一条更真实的门店视频，重点讲清楚${form.storeAdvantages || "真实体验"}。

9. 话题标签
#健身房 #本地生活 #门店视频

10. 评论区引导
你更在意环境、价格还是服务？留言给我，我按这个方向再写一版。

11. 拍摄执行提醒
优先拍门头、器械区、训练状态和前台，不要用空镜堆满整条视频。`,
});

const buildLiveFallback = (form: LiveForm): LocalFallbackResult => ({
  type: "text",
  note: "当前文本模型未稳定返回，已给你一版按成交顺序整理好的直播话术底稿。",
  text: `【开场】
刚进来的朋友先别划走，今天这场直播重点讲${form.campaignTheme || "门店活动"}，门店就在${form.location || "目标门店位置"}。如果你最近正在考虑减脂、塑形、恢复训练状态，或者总想开始却迟迟没开始，今天这场你先听我讲完。

【门店优势】
我们门店的核心优势是${form.storeAdvantages || "真实门店卖点"}。你来健身不是只看一个价格，真正影响你能不能坚持下去的，是环境、器械、训练氛围和到店体验。

【痛点对比】
很多人不是不想练，是一直在拖。平时自己去问，价格和活动力度不一定有今天直播间这么直接；而且越拖，开始训练这件事就越难。

【团单三拆】
先把这张团单拆开讲。第一是价格对比，要讲清平时了解和今天直播间的差别。第二是按天拆解，让用户知道平均下来每天其实没多少钱。第三是权益拆解，把${form.offerContent || "团单内容"}一条条讲清，告诉用户每一项到底值在哪里。

【逼单】
今天这波活动就是有限时窗口的，不是你明后天再来问还一定有这个力度。名额也是按活动节奏在走，真准备开始训练的，别一直等，合适就先锁。

【保障】
你不用担心拍了之后不适合自己，先来店里看看环境、看看器械、看看训练氛围，觉得合适再往下走。规则能讲清楚的我们都讲清楚，不要带着顾虑下单。

【核销】
下单之后别一直拖，尽快安排时间来店里。${form.extraNotes.trim() || "默认带7天内核销有礼"}，让用户知道什么时候来、来了先做什么、怎么开始体验。`,
});

const buildXhsNoteFallback = (form: XiaohongshuForm): LocalFallbackResult => ({
  type: "text",
  note: "当前文本模型未稳定返回，已给你一版可直接调整的小红书笔记底稿。",
  text: `笔记路线：${form.route || "探店种草笔记"}
标题1：最近看了一家健身房，我终于知道什么叫更容易坚持
标题2：${form.productName || "这家健身房"}最打动我的，不只是器械
标题3：如果你最近也在看附近健身房，这篇可以先看完
开头钩子：我最近去看了一家健身房，原本只是随便看看，结果有几个细节确实挺加分。
正文成稿：门店在${form.location || "本地商圈"}，主打的是${form.productName || "门店主推内容"}。如果你最近也在找一家更容易坚持下来的健身房，这家确实有几个点让我愿意多了解一下。门店卖点主要是${form.storeHighlights || "真实门店体验"}，再加上${form.benefits || "相关权益"}，整体更像一套完整体验，而不是只卖一张卡。${form.route.includes("团购") && form.price ? `如果你走的是团购转化路线，价格信息是${form.price}，可以把价格和权益讲清楚。` : "如果你走的是探店或轻IP路线，就让内容更偏真实体验，不要太像广告。"}
分段小标题：
1. 我先看中的是什么
2. 真正让我想继续了解的细节
3. 哪类人会更适合
结尾互动句：如果你最近也在看附近的健身房，可以把你最在意的点留言给我，我按真实体验继续写。
标签建议：#健身房 #本地生活 #健身探店
封面文案：${form.productName || "健身房真实体验"}，到底值不值得去看`,
});

const buildXhsImageFallback = (form: XiaohongshuForm): LocalFallbackResult => ({
  type: "prompt",
  note: "当前环境未直接完成出图，已输出最终生图提示词。",
  text: `最终生图提示词：为“小红书笔记图”制作一张3:4竖版封面，主标题是“${form.productName || "健身探店"}”，路线是“${form.route || "探店种草笔记"}”，主题色围绕“${form.themeColor || "用户主题色"}”展开，保持大体色差不变，只允许同色系明暗、渐变和材质延展。主标题放中上区域，避开顶部和底部UI遮挡区，字少、字大、对比强。画面主体必须是健身房器械区、镜面墙、训练动作、前台或真实门店氛围，不要出现咖啡厅、家居、美妆店或无关ins风场景。${form.route.includes("团购") && form.price ? `这是团购转化型封面，可以突出价格“${form.price}”。` : "这不是强促销海报，要更像真实种草或轻IP封面。"} 画面中仅允许出现这些中文文案：${allowedVisualText(form) || form.productName || "健身探店"}。不要额外编造价格、权益、电话、二维码、地址和品牌名。${form.extraNotes ? `补充要求：${form.extraNotes}。` : ""}`,
});

export const buildLocalFallback = (payload: StudioPayload): LocalFallbackResult => {
  switch (payload.skill) {
    case "chanping-toutu":
      return buildVisualFallback(payload.form);
    case "duanshipin-moban":
      return buildVideoFallback(payload.form);
    case "zhibo-huashu":
      return buildLiveFallback(payload.form);
    case "xiaohongshu-biji":
      return buildXhsNoteFallback(payload.form);
    case "xiaohongshu-bijitu":
      return buildXhsImageFallback(payload.form);
  }
};
