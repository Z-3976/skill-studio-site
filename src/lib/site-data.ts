export type SkillId =
  | "chanping-toutu"
  | "duanshipin-moban"
  | "zhibo-huashu"
  | "xiaohongshu-biji";

export type SkillCard = {
  id: SkillId;
  index: string;
  title: string;
  kicker: string;
  blurb: string;
  tags: string[];
};

export const skillCards: SkillCard[] = [
  {
    id: "chanping-toutu",
    index: "01",
    title: "产品头图",
    kicker: "视觉设计",
    blurb: "头图 / KT板 / 门店宣传图",
    tags: ["4:3头图", "A4 / A3 KT板", "主题色控制"],
  },
  {
    id: "duanshipin-moban",
    index: "02",
    title: "短视频模板",
    kicker: "视频脚本",
    blurb: "营销 / 轻IP / 素人氛围",
    tags: ["营销转化", "多场景拍摄", "轻IP口播"],
  },
  {
    id: "zhibo-huashu",
    index: "03",
    title: "直播话术",
    kicker: "直播脚本",
    blurb: "开场 / 逼单 / 核销闭环",
    tags: ["团单三拆", "逼单保障", "核销闭环"],
  },
  {
    id: "xiaohongshu-biji",
    index: "04",
    title: "小红书笔记",
    kicker: "种草内容",
    blurb: "笔记成稿 / 3:4封面图",
    tags: ["团购转化", "探店种草", "封面图"],
  },
];
