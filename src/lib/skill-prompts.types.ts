export type LocalFallbackResult = {
  type: "text" | "prompt";
  note: string;
  text: string;
};

export type PromptConfig = {
  kind: "text" | "image";
  systemPrompt: string;
  userPrompt: string;
  imageSize?: "1024x1536" | "1536x1024";
  successNote?: string;
  reviewSystemPrompt?: string;
  buildReviewUserPrompt?: (draft: string) => string;
};
