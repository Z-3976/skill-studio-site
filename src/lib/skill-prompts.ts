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
你是门店商业视觉设计主创，负责把门店团购、健身卡、套餐、宣传图做成适合抖音本地生活和健身房转化的商业成图。

必须遵守：
1. 风格优先参考用户给的样板图。
2. 默认产品头图为 4:3 横版，中间核心内容控制在 1:1 安全区，避免裁切。
3. KT板默认按竖版宣传板逻辑排版。
4. 用户提供的主题色属于强约束，整体颜色体系只能做明暗、渐变、质感延展，不要明显跑色。
5. Logo 放上方或视觉核心区。
6. 主标题大字突出，重点突出套餐名、价格、权益。
7. 少小字，整体要高级、清晰、有商业感。
8. 如果不能直接生成图片，只输出“最终生图提示词：”后面接最终中文提示词，不输出冗长解释。
`;

const VIDEO_RULES = `
你是抖音本地生活和健身行业的短视频主笔，输出要接近可直接开拍的成片文案。

必须遵守：
1. 先基于用户给的路线写，不要混线。
2. 营销短视频允许出现价格、价格拆分、权益打包、下单引导、库存和时效提醒。
3. 官方轻IP / 3km大众熟人禁止出现价格、促单、库存不多、左下角下单这类营销表达。
4. 素人氛围号强调场景、细节、情绪和生活感，不要写成广告。
5. 默认输出接近可直接拍摄版本，优先给多场景拍摄方案。
6. 语气真实、口语化、有人味，不要像通知或作文。
`;

const LIVE_RULES = `
你是抖音本地生活直播成交策划，负责生成更像主播现场能说出来、而且顺着成交流程推进的直播话术。

固定流程必须是：
开场 → 门店优势 → 痛点对比 → 团单三拆 → 逼单 → 保障 → 核销

必须遵守：
1. 团单三拆优先包含：原价现价、日均价格、权益打包。
2. 逼单先讲时间，再讲数量，再给动作。
3. 保障放在逼单之后。
4. 核销要单独讲清楚，例如 7 天内核销送小礼品。
5. 输出口语化、短句化、可直播复用。
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
    .split(/\n|，|、|,|;|；/)
    .map((item) => item.trim())
    .filter(Boolean);

export const buildSkillInstructions = (payload: StudioPayload) => {
  if (payload.skill === "chanping-toutu") {
    const { form } = payload;

    const summary = [
      field("设计类型", form.designType),
      field("门店名称", form.storeName),
      field("产品名称", form.productName),
      field("产品价格", form.price),
      field("产品权益", form.benefits),
      field("主题色", form.themeColor),
      field("补充要求", form.extraNotes),
    ].join("\n");

    return {
      systemPrompt: VISUAL_RULES,
      userPrompt: `
请基于以下信息为我整理最终成图方案：

${summary}

输出要求：
1. 如果当前环境不支持直接生图，只输出“最终生图提示词：”后面接最终中文提示词。
2. 如果用于头图，构图按 4:3 横版 + 中间 1:1 安全区来组织。
3. 如果用于 KT 板，版式按竖版线下物料逻辑组织。
4. 参考样板图只做风格参考，最终内容必须准确体现套餐名、价格和权益。
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
${field("门店优势", form.storeAdvantages)}
${field("目标人群", form.targetAudience)}
${field("参考资料", form.sourceNotes)}
${field("补充要求", form.extraNotes)}

默认输出：
- 路线
- 标题
- 前 3 秒钩子
- 完整口播稿
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

输出要清晰分段，严格按以下顺序：
1. 开场
2. 门店优势
3. 痛点对比
4. 团单三拆
5. 逼单
6. 保障
7. 核销
`,
  };
};

export const buildLocalFallback = (payload: StudioPayload): LocalFallbackResult => {
  if (payload.skill === "chanping-toutu") {
    const designType = asText(payload.form.designType) || "产品头图";
    const productName = asText(payload.form.productName) || "门店产品";
    const price = asText(payload.form.price) || "价格信息醒目展示";
    const benefits = asList(payload.form.benefits);
    const themeColor = asText(payload.form.themeColor) || "用户主题色";
    const storeName = asText(payload.form.storeName);
    const benefitText = benefits.length ? benefits.join("、") : "核心权益清晰展示";

    return {
      type: "prompt",
      note: "当前未配置 OpenAI API Key，已按 skill 规则返回可直接生图的最终提示词。",
      text: `最终生图提示词：为${storeName ? `${storeName}的` : ""}${designType}制作一张高级商业视觉海报，主内容为“${productName}”，价格信息为“${price}”，核心权益包含“${benefitText}”。整体风格参考用户提供的样板图，若是头图则使用 4:3 横版构图，中间核心内容控制在 1:1 安全区，避免裁切；若是 KT 板则按竖版宣传板逻辑排版。Logo 放上方或视觉核心区，主标题大字突出，重点突出套餐名、价格、权益，少小字，适合抖音团购、本地生活、健身房宣传。主色严格围绕“${themeColor}”展开，只做明暗、渐变和质感延展，不要明显跑色。整体要清晰、高级、有商业感，可加入健身氛围元素、发光边缘、金属或玻璃质感装饰，但不要抢主标题。`,
    };
  }

  if (payload.skill === "duanshipin-moban") {
    const route = asText(payload.form.route) || "营销短视频";
    const goal = asText(payload.form.goal) || "提升转化";
    const productName = asText(payload.form.productName) || "门店主推产品";
    const price = asText(payload.form.price);
    const storeAdvantages = asText(payload.form.storeAdvantages) || "门店优势待补充";
    const audience = asText(payload.form.targetAudience) || "附近潜在人群";
    const isLightIp = route.includes("轻IP") || route.includes("3km");
    const isAtmosphere = route.includes("素人");
    const isMarketing = route.includes("营销");

    const hook = isMarketing
      ? `${price ? `${price}这件事，很多人一听就觉得只是便宜，但真正值钱的是后面这一整套体验。` : `如果你最近正想开始锻炼，这条就是给你的。`}`
      : isLightIp
        ? `最近店里来问${productName}的人很多，但我更想先把真实情况讲清楚。`
        : `今天在店里待了一会儿，我突然明白为什么有人会喜欢这种训练状态。`;

    const ending = isMarketing
      ? `结尾动作：左下角看链接，适合你的先囤上，活动和名额都不是一直有。`
      : `结尾动作：欢迎来店里看看环境、感受氛围，先熟悉我们，再决定下一步。`;

    const priceLine = isMarketing && price ? `价格表达：${price}` : "价格表达：本路线默认不强调价格";

    return {
      type: "text",
      note: "当前未配置 OpenAI API Key，已按 skill 规则生成模板版短视频脚本。",
      text: `路线：${route}
标题：${productName}这条视频怎么拍更容易让人停下来
前3秒钩子：${hook}
视频目标：${goal}
适合人群：${audience}
${priceLine}

完整口播稿：
${hook}
我们这边最想先让大家感受到的，不只是一个单独的产品，而是整个训练体验。
像${storeAdvantages}，这些都不是一句“环境不错”能带过去的，是用户一到店就能感受到的差别。
${isLightIp ? "所以这条内容不聊促销，不催你下单，只想先把店里的真实状态、服务细节和训练氛围讲明白。" : ""}
${isAtmosphere ? "如果你也喜欢那种练完以后整个人松下来、出点汗、状态被拉回来的感觉，这种内容就很适合做成多场景的氛围视频。" : ""}
${isMarketing ? `如果你做的是营销路线，就把${productName}的价值、对比感和性价比拆清楚，再把行动引导收住。` : "如果你做的是信任路线，就多讲真实场景、日常细节和人与人的互动感。"}

分镜建议：
1. 门头或外景开场，快速立住门店气质。
2. 前台或进门动线，给真实到店感。
3. 器械区全景 + 局部特写，对应门店优势。
4. 教练或会员互动镜头，补信任感。
5. 结尾边走边说，收动作。

多场景拍摄安排：
场景1：门头外景。画面：进店镜头。口播：${hook}
场景2：器械区。画面：全景切设备细节。口播：重点讲${storeAdvantages}
场景3：互动区。画面：教练巡场或会员训练。口播：讲真实体验和适合谁
场景4：收尾区。画面：边走边说。口播：${ending.replace("结尾动作：", "")}

屏幕字幕：
- ${productName}
- ${goal}
- ${isMarketing ? "高性价比 / 现在更适合下手" : "真实门店 / 真实体验 / 真实氛围"}

${ending}
封面文案：${productName}这条，别拍得太像广告`,
    };
  }

  const location = asText(payload.form.location) || "门店位置待补充";
  const campaignTheme = asText(payload.form.campaignTheme) || "活动主题待补充";
  const storeAdvantages = asText(payload.form.storeAdvantages) || "门店优势待补充";
  const offerContent = asText(payload.form.offerContent) || "团单内容待补充";
  const goal = asText(payload.form.goal) || "成交转化";
  const audience = asText(payload.form.targetAudience) || "附近潜在人群";

  return {
    type: "text",
    note: "当前未配置 OpenAI API Key，已按 skill 规则生成流程化直播话术。",
    text: `任务模式：${asText(payload.form.mode) || "生成模式"}
直播目标：${goal}

1. 开场
欢迎刚进来的宝子，先给大家报一下位置，我们店就在${location}。今天这场直播的主题很直接，就是${campaignTheme}，如果你最近在看健身卡、想找一个更舒服更省心的训练地方，可以先听我讲完。

2. 门店优势
我们这边和很多普通场馆不一样的地方，核心就在于：${storeAdvantages}。也就是说，你来这边不是只买一张卡，而是买一个更完整、更省事、更容易坚持的训练体验。

3. 痛点对比
很多人以前办卡坚持不下来，不一定是你不自律，很多时候是场地挤、器械旧、空气闷、洗澡麻烦、停车不方便，练一次就觉得累。那我们做这套内容，就是把这些真正影响体验的点尽量提前解决掉，让你更容易开始，也更容易坚持。

4. 团单三拆
第一种拆法：先把${offerContent}本身讲清楚，原价和现在活动价的差值要让用户一听就知道划不划算。
第二种拆法：如果这是月卡、季卡这种按天算得清的产品，就直接拆到日均成本，让用户知道每天的门槛其实没有想象中高。
第三种拆法：把卡项之外的权益一起打包讲，比如服务、体验、到店便利性和配套，强调这不是单买一张卡，而是一整套训练体验。

5. 逼单
宝子们，这种活动一般都不是一直挂着的，我建议你们如果刚好在看卡，就趁这场直播先把名额占住。先看时间，再看数量，活动结束或者这波名额收掉，后面就不一定还是这个节奏了。

6. 保障
但你也不用担心到店之后乱收费、强推销或者实际和直播说的不一样。我们这边话术怎么讲，到店就怎么落，先把顾虑讲清楚，再让你安心做决定。

7. 核销
拍下来的宝子记得尽快来核销。最好把核销时间、核销流程和额外福利单独讲明白，比如 7 天内核销送小礼品，或者先核销再安排开卡和体验，这样用户行动会更明确。

适合人群：${audience}`,
  };
};
