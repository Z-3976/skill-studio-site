export type SkillId =
  | "chanping-toutu"
  | "duanshipin-moban"
  | "zhibo-huashu"
  | "xiaohongshu-biji"
  | "xiaohongshu-bijitu";

export type SkillCard = {
  id: SkillId;
  index: string;
  title: string;
  subtitle: string;
  placeholder: string;
};

export const skillCards: SkillCard[] = [
  {
    id: "chanping-toutu",
    index: "01",
    title: "产品头图",
    subtitle: "头图 / KT板 / 宣传图",
    placeholder:
      "直接说需求，比如：做一张99元健身月卡头图，薄荷青主色，突出免费淋浴、免费停车、巡场教练和体测。",
  },
  {
    id: "duanshipin-moban",
    index: "02",
    title: "短视频脚本",
    subtitle: "营销 / 轻IP / 核销 / 引流",
    placeholder:
      "直接说脚本需求，比如：写一个99元健身月卡营销视频，要有259对比99、按天拆解、后半段下单引导。",
  },
  {
    id: "zhibo-huashu",
    index: "03",
    title: "直播话术",
    subtitle: "开场 / 三拆 / 逼单 / 核销",
    placeholder:
      "直接说直播需求，比如：写一版新店预售直播话术，要有位置、门店优势、痛点对比、团单三拆、逼单、保障和核销。",
  },
  {
    id: "xiaohongshu-biji",
    index: "04",
    title: "小红书笔记",
    subtitle: "正文 / 标题 / 标签",
    placeholder:
      "直接说笔记需求，比如：写一篇99元健身月卡探店种草笔记，语气真实一点，不要太像广告。",
  },
  {
    id: "xiaohongshu-bijitu",
    index: "05",
    title: "小红书笔记图",
    subtitle: "3:4封面 / 种草图",
    placeholder:
      "直接说封面需求，比如：做一张小红书健身探店封面，颜色高级一点，像真实探店内容，不要像强促销海报。",
  },
];
