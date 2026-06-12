export type SkillId = "chanping-toutu" | "duanshipin-moban" | "zhibo-huashu";

export const skillCards = [
  {
    id: "chanping-toutu" as const,
    index: "01",
    title: "产品头图",
    kicker: "视觉设计",
    blurb: "头图 / KT 板 / 门店宣传",
    tags: ["4:3 头图", "A4 / A3 KT 板", "主题色控制"],
  },
  {
    id: "duanshipin-moban" as const,
    index: "02",
    title: "短视频模板",
    kicker: "视频文案",
    blurb: "营销 / 轻 IP / 素人氛围号",
    tags: ["营销转化", "多场景拍摄", "轻 IP 口播"],
  },
  {
    id: "zhibo-huashu" as const,
    index: "03",
    title: "直播话术",
    kicker: "直播脚本",
    blurb: "开场 / 逼单 / 核销闭环",
    tags: ["团单三拆", "逼单保障", "核销闭环"],
  },
];
