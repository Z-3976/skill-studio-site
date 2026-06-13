import type { SkillId } from "@/lib/site-data";

export type ResultType = "text" | "image" | "prompt";

export type UploadAsset = {
  name: string;
  dataUrl: string;
  mediaType: string;
};

export type VisualForm = {
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

export type VideoForm = {
  route: string;
  goal: string;
  productName: string;
  price: string;
  storeAdvantages: string;
  targetAudience: string;
  sourceNotes: string;
  extraNotes: string;
};

export type LiveForm = {
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

export type XiaohongshuOutputType = "小红书笔记" | "小红书笔记图";

export type XiaohongshuForm = {
  outputType: XiaohongshuOutputType;
  route: string;
  goal: string;
  storeName: string;
  location: string;
  productName: string;
  price: string;
  benefits: string;
  storeHighlights: string;
  targetAudience: string;
  referenceStyle: string;
  themeColor: string;
  tone: string;
  hashtags: string;
  extraNotes: string;
  logoAssets: UploadAsset[];
  referenceAssets: UploadAsset[];
};

export type StudioPayload =
  | { skill: "chanping-toutu"; form: VisualForm }
  | { skill: "duanshipin-moban"; form: VideoForm }
  | { skill: "zhibo-huashu"; form: LiveForm }
  | { skill: "xiaohongshu-biji"; form: XiaohongshuForm };

export type ResultMeta = {
  route?: string;
  titles?: string[];
  coverCopy?: string;
  hashtags?: string[];
  reviewSummary?: string;
};

export type AssistantResult = {
  type: ResultType;
  text: string;
  note?: string;
  actions?: string[];
  imageDataUrl?: string;
  meta?: ResultMeta;
};

export type StreamEvent =
  | { type: "status"; message: string }
  | { type: "chunk"; text: string }
  | { type: "result"; data: AssistantResult }
  | { type: "error"; error: string };

export type StudioMessage = {
  id: string;
  role: "user" | "assistant";
  skillId: SkillId;
  title: string;
  content: string;
  createdAt: string;
  note?: string;
  actions?: string[];
  imageDataUrl?: string;
  resultType?: ResultType;
  meta?: ResultMeta;
};
