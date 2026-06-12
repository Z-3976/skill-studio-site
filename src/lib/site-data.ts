export type SkillId = "chanping-toutu" | "duanshipin-moban" | "zhibo-huashu";

export const skillCards = [
  {
    id: "chanping-toutu" as const,
    index: "01",
    title: "产品头图",
    kicker: "Visual",
    blurb: "头图 / KT板 / 门店视觉",
    tags: ["4:3", "KT板", "主题色"],
  },
  {
    id: "duanshipin-moban" as const,
    index: "02",
    title: "短视频模板",
    kicker: "Script",
    blurb: "营销 / 轻IP / 氛围号",
    tags: ["多场景", "轻IP", "转化"],
  },
  {
    id: "zhibo-huashu" as const,
    index: "03",
    title: "直播话术",
    kicker: "Live",
    blurb: "开场 / 逼单 / 核销",
    tags: ["三拆", "保障", "闭环"],
  },
];
