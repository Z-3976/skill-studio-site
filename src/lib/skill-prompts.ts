import type { SkillId } from "@/lib/site-data";

export type UploadAsset = {
  name: string;
  dataUrl: string;
  mediaType: string;
};

export type StudioPayload = {
  skill: SkillId;
  form: Record<string, string | boolean | UploadAsset[] | null | undefined>;
};

export type LocalFallbackResult = {
  type: "text" | "prompt";
  note: string;
  text: string;
};

const VISUAL_RULES = `
你是门店商业视觉设计总监，负责把门店团购、健身卡、套餐图、产品头图和 KT 板，整理成可直接用于出图的最终中文提示词。

必须遵守：
1. 优先参考用户提供的样板图，只借鉴风格、版式、质感，不篡改当前套餐内容。
2. 默认产品头图按 4:3 横版构图，中间核心内容严格控制在 1:1 安全区，避免裁切。
3. A4/A3 KT 板按竖版线下宣传物料逻辑排版。
4. 用户给的主题色是强约束，只允许做同色系的明暗、渐变和材质延展，不要明显跑色。
5. 如果用户上传了 Logo，要把 Logo 放在上方或视觉核心区，并尽量保留原始图形特征。
6. 主标题大字突出，重点突出套餐名、价格、权益，少小字。
7. 整体要高级、清晰、有商业感，适合抖音团购、本地生活、健身房宣传。
8. 如果环境不支持直接生图，只输出“最终生图提示词：”后接最终中文提示词，不要额外解释。
`;

const VIDEO_RULES = `
你是抖音本地生活和健身行业的视频脚本主笔，输出必须接近可直接拍摄的成片脚本。

必须遵守：
1. 严格按照用户指定的路线来写，不要混路线。
2. 营销短视频可以出现价格、价格拆分、权益打包、下单引导、库存提醒和活动时效。
3. 官方轻 IP / 3km 大众熟人路线禁止出现价格、促单、库存不多、左下角下单这类营销表达。
4. 素人氛围号重点写场景、细节、状态和生活感，不要写成硬广。
5. 默认输出要包含多场景拍摄建议，口语化、真实、有镜头感。
6. 不要写得像通知或作文，要像门店真的会拍、真的会说。
`;

const LIVE_RULES = `
你是抖音本地生活直播成交策划，负责生成可直接复用的直播话术。

固定流程必须是：
开场 → 门店优势 → 痛点对比 → 团单三拆 → 逼单 → 保障 → 核销

必须遵守：
1. 团单三拆优先包含：原价对比、日均拆分、权益打包。
2. 逼单先讲时间，再讲数量，再给行动指令。
3. 保障必须放在逼单之后。
4. 核销要单独说清楚，比如 7 天内核销送小礼品。
5. 整体口语化、短句化、可直接直播复述。
`;

const field = (label: string, value: string | boolean | UploadAsset[] | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return `${label}：未提供`;
  }

  if (typeof value === "boolean") {
    return `${label}：${value ? "是" : "否"}`;
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      return `${label}：未提供`;
    }

    return `${label}：${value.map((item) => item.name).join("、")}`;
  }

  return `${label}：${value}`;
};

const asText = (value: string | boolean | UploadAsset[] | null | undefined) =>
  typeof value === "string" ? value.trim() : "";

const asList = (value: string | boolean | UploadAsset[] | null | undefined) =>
  asText(value)
    .split(/\r?\n|、|,|，|;|；/)
    .map((item) => item.trim())
    .filter(Boolean);

export const buildSkillInstructions = (payload: StudioPayload) => {
  if (payload.skill === "chanping-toutu") {
    const { form } = payload;

    const summary = [
      field("设计类型", form.designType),
      field("门店名称", form.storeName),
      field("产品名称", form.productName),
      field("价格信息", form.price),
      field("产品权益", form.benefits),
      field("主题色", form.themeColor),
      field("风格补充", form.extraNotes),
      field("Logo 素材", form.logoAssets),
      field("参考样板图", form.referenceAssets),
    ].join("\n");

    return {
      systemPrompt: VISUAL_RULES,
      userPrompt: `
请基于以下信息，为我整理最终出图方案：

${summary}

输出要求：
1. 如果用户上传了 Logo，请在最终提示词里明确要求保留 Logo 的结构特征，并放在上方或视觉核心区。
2. 如果用户上传了样板图，请把它作为风格参考，但最终内容必须准确体现当前套餐名、价格和权益。
3. 如果是产品头图，构图按 4:3 横版，中间 1:1 安全区组织核心信息。
4. 如果是 KT 板，按竖版线下宣传物料逻辑组织版式。
5. 只输出最终可直接用于生图的中文提示词，不要拆解过程。
`,
    };
  }

  if (payload.skill === "duanshipin-moban") {
    const { form } = payload;

    return {
      systemPrompt: VIDEO_RULES,
      userPrompt: `
请为我生成一版短视频脚本，尽量贴近可直接拍摄：
${field("脚本路线", form.route)}
${field("视频目标", form.goal)}
${field("产品名称", form.productName)}
${field("价格信息", form.price)}
${field("门店卖点", form.storeAdvantages)}
${field("目标人群", form.targetAudience)}
${field("参考资料", form.sourceNotes)}
${field("补充要求", form.extraNotes)}

默认输出包含：
- 路线
- 标题
- 前 3 秒钩子
- 完整口播
- 分镜建议
- 多场景拍摄安排
- 屏幕字幕
- 结尾动作
- 封面文案
`,
    };
  }

  const { form } = payload;

  return {
    systemPrompt: LIVE_RULES,
    userPrompt: `
请为我生成或优化直播话术：
${field("任务模式", form.mode)}
${field("门店位置", form.location)}
${field("活动主题", form.campaignTheme)}
${field("门店优势", form.storeAdvantages)}
${field("团单内容", form.offerContent)}
${field("直播目标", form.goal)}
${field("适合人群", form.targetAudience)}
${field("已有话术", form.currentScript)}
${field("补充要求", form.extraNotes)}

输出要求：
1. 严格按“开场 → 门店优势 → 痛点对比 → 团单三拆 → 逼单 → 保障 → 核销”顺序写。
2. 每段都要口语化，方便主播直接照着说。
3. 如果用户提供了原话术，要基于原内容优化，不要完全换风格。
`,
  };
};

export const buildLocalFallback = (payload: StudioPayload): LocalFallbackResult => {
  if (payload.skill === "chanping-toutu") {
    const designType = asText(payload.form.designType) || "产品头图";
    const storeName = asText(payload.form.storeName);
    const productName = asText(payload.form.productName) || "门店产品";
    const price = asText(payload.form.price) || "价格醒目展示";
    const benefits = asList(payload.form.benefits);
    const themeColor = asText(payload.form.themeColor) || "用户主题色";
    const extraNotes = asText(payload.form.extraNotes);
    const benefitText = benefits.length ? benefits.join("、") : "核心权益清晰展示";

    return {
      type: "prompt",
      note: "当前无法直接生图，已返回最终生图提示词。",
      text: `最终生图提示词：为${storeName ? `${storeName}的` : ""}${designType}制作一张高级商业宣传视觉，主内容为“${productName}”，价格重点突出“${price}”，核心权益包含“${benefitText}”。整体构图如果是头图则按 4:3 横版排版，中间核心信息控制在 1:1 安全区；如果是 KT 板则按竖版物料逻辑排版。Logo 放上方或视觉核心区，主标题大字突出，少小字，适合抖音团购、本地生活和健身房宣传。主色严格围绕“${themeColor}”展开，只做同色系的明暗、渐变和材质延展，不要明显跑色。整体质感高级、清晰、利落、有商业感。${extraNotes ? `补充要求：${extraNotes}。` : ""}`,
    };
  }

  if (payload.skill === "duanshipin-moban") {
    const route = asText(payload.form.route) || "营销短视频";
    const goal = asText(payload.form.goal) || "提升转化";
    const productName = asText(payload.form.productName) || "门店主推产品";
    const price = asText(payload.form.price);
    const storeAdvantages = asText(payload.form.storeAdvantages) || "门店卖点待补充";
    const audience = asText(payload.form.targetAudience) || "附近潜在人群";
    const isMarketing = route.includes("营销");
    const isLightIp = route.includes("轻 IP") || route.includes("3km");

    const hook = isMarketing
      ? `${price ? `${price}这件事，很多人第一反应是便宜，但真正划算的是它后面的整套体验。` : `最近如果你正想开始锻炼，这条内容可以先看完。`}`
      : isLightIp
        ? `最近来问${productName}的人不少，但我更想先把真实体验讲清楚。`
        : `今天在店里待了一会儿，突然明白为什么有些人会慢慢爱上训练。`;

    return {
      type: "text",
      note: "当前模型不可用，已按本地规则返回一版脚本草稿。",
      text: `路线：${route}
标题：${productName}这样拍，更容易让人停下来
前 3 秒钩子：${hook}
视频目标：${goal}
适合人群：${audience}

完整口播：
${hook}
我们这边想传递的不只是一个产品价格，而是一整套更容易坚持下来的训练体验。像${storeAdvantages}，这些不是一句“环境不错”就能带过去的，而是用户一到店就能感受到的差别。${isLightIp ? "这条内容不聊价格，也不催下单，只把门店的真实氛围和服务细节讲明白。" : ""}${isMarketing && price ? `如果你做的是营销视频，就把“${price}”拆清楚，把价值感和行动引导一起收住。` : ""}

分镜建议：
1. 门头或前台开场，先立住门店气质。
2. 器械区全景加局部特写，对应门店卖点。
3. 教练或会员互动镜头，补足真实感和信任感。
4. 收尾镜头边走边说，做动作引导。

多场景拍摄：
场景 1：门头外景。口播：${hook}
场景 2：器械区。口播：重点讲${storeAdvantages}
场景 3：互动区。口播：讲真实体验和适合谁
场景 4：收尾区。口播：自然收口，不要太像广告

屏幕字幕：
- ${productName}
- ${goal}
- ${isMarketing ? "高性价比 / 可以直接转化" : "真实门店 / 真实体验 / 真实氛围"}

结尾动作：${isMarketing ? "引导看链接，提醒活动不是一直有。" : "欢迎先来店里看看，先熟悉再决定。"}
封面文案：${productName}，别拍得太像广告`,
    };
  }

  const mode = asText(payload.form.mode) || "生成模式";
  const location = asText(payload.form.location) || "门店位置待补充";
  const campaignTheme = asText(payload.form.campaignTheme) || "活动主题待补充";
  const storeAdvantages = asText(payload.form.storeAdvantages) || "门店优势待补充";
  const offerContent = asText(payload.form.offerContent) || "团单内容待补充";
  const goal = asText(payload.form.goal) || "成交转化";
  const audience = asText(payload.form.targetAudience) || "附近潜在人群";

  return {
    type: "text",
    note: "当前模型不可用，已按既定框架返回一版直播话术草稿。",
    text: `任务模式：${mode}
直播目标：${goal}

1. 开场
欢迎刚进来的朋友，先报一下位置，我们门店就在${location}。今天这场直播的主题很直接，就是${campaignTheme}，如果你最近在看健身卡，先听我把重点讲完。

2. 门店优势
我们跟普通场馆不太一样，核心就在于：${storeAdvantages}。你来这里，不只是办一张卡，而是买一个更容易坚持的训练环境。

3. 痛点对比
很多人不是不想练，而是场地挤、器械旧、空气闷、停车麻烦、洗澡不方便，练一次就累了。我们做这套团单，就是尽量把这些真正影响体验的问题先解决掉。

4. 团单三拆
第一种拆法：讲清原价和活动价的差值。
第二种拆法：如果是月卡、季卡，就拆到日均成本。
第三种拆法：把${offerContent}背后的权益一起讲，让用户知道这不是单买一张卡，而是一整套体验。

5. 逼单
这种活动一般不会一直挂着。先讲时间，再讲数量，如果你刚好在看卡，建议先把名额占住。

6. 保障
你也不用担心到店以后乱收费或者强推销。直播怎么讲，到店就怎么落，让你先把顾虑放下，再安心做决定。

7. 核销
拍下来的朋友尽快核销。核销时间、流程和额外福利要单独讲清楚，比如 7 天内核销送小礼品。

适合人群：${audience}`,
  };
};
