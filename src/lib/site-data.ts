export type SkillId = "chanping-toutu" | "duanshipin-moban" | "zhibo-huashu";

export const skillCards = [
  {
    id: "chanping-toutu" as const,
    index: "01",
    title: "产品头图",
    kicker: "Visual Studio",
    blurb:
      "围绕 Logo、产品信息、主题色和参考样板图，直接生成产品头图、A4/A3 KT板和门店宣传视觉。",
    tags: ["4:3 头图", "A4 / A3 KT板", "主题色约束"],
  },
  {
    id: "duanshipin-moban" as const,
    index: "02",
    title: "短视频模板",
    kicker: "Video Script Lab",
    blurb:
      "按营销短视频、官方轻IP、素人氛围号、预热/核销/引流四条路线，生成可直接拍摄的脚本。",
    tags: ["多场景拍摄", "轻IP分流", "营销强转化"],
  },
  {
    id: "zhibo-huashu" as const,
    index: "03",
    title: "直播话术",
    kicker: "Live Script Engine",
    blurb:
      "根据门店位置、活动主题、门店优势、团单内容或现有话术，快速生成成交流程更顺的直播脚本。",
    tags: ["团单三拆", "逼单保障", "核销闭环"],
  },
];

export const workflowSteps = [
  {
    title: "选技能",
    desc: "在三个工作台之间切换，按你当前业务场景发起生成。",
  },
  {
    title: "填信息",
    desc: "把门店、产品、卖点、主题色、脚本方向一次填全，减少反复沟通。",
  },
  {
    title: "出结果",
    desc: "文本类直接生成可用文案，视觉类在支持图像能力时直接出图，不支持时返回最终提示词。",
  },
];
