import { mkdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";
import {
  buildLocalFallback,
  buildSkillInstructions,
  extractResultMeta,
  isImagePayload,
  type StudioPayload,
  type UploadAsset,
} from "@/lib/skill-prompts";
import type { PromptConfig } from "@/lib/skill-prompts";
import type { AssistantResult, StreamEvent } from "@/lib/studio-types";

export const runtime = "nodejs";
export const maxDuration = 300;

type TextGenerationResult = {
  text: string;
};

const textModel = process.env.DEEPSEEK_TEXT_MODEL?.trim() || "deepseek-chat";
const textBaseUrl = process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com";
const imageModel = "gpt-image-2";
const textTimeoutMs = 40_000;
const imageTimeoutMs = 120_000;

const imageEnabled =
  process.env.ENABLE_IMAGE_GENERATION === "true" || process.env.ENABLE_IMAGE_GENERATION === "1";

const textClient = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: textBaseUrl,
      timeout: 90_000,
      maxRetries: 1,
    })
  : null;

const imageClient = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 180_000,
      maxRetries: 1,
    })
  : null;

const encoder = new TextEncoder();

const logGenerationError = (scope: string, error: unknown) => {
  console.error(`[${scope}]`, error);
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "生成失败，请稍后重试。";

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string) =>
  Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
    }),
  ]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractCompletionText = (content: unknown) => {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
};

const inferExtension = (mediaType: string) => {
  if (mediaType.includes("png")) return "png";
  if (mediaType.includes("webp")) return "webp";
  if (mediaType.includes("jpeg") || mediaType.includes("jpg")) return "jpg";
  return "png";
};

const collectImageAssets = (payload: StudioPayload) => {
  if (payload.skill === "chanping-toutu" || payload.skill === "xiaohongshu-biji") {
    return {
      logoAssets: payload.form.logoAssets || [],
      referenceAssets: payload.form.referenceAssets || [],
    };
  }

  return {
    logoAssets: [] as UploadAsset[],
    referenceAssets: [] as UploadAsset[],
  };
};

const assetToFile = async (asset: UploadAsset, index: number) => {
  const match = asset.dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    return null;
  }

  const mediaType = asset.mediaType || match[1] || "image/png";
  const buffer = Buffer.from(match[2], "base64");
  const fallbackName = `upload-${index + 1}.${inferExtension(mediaType)}`;
  const filename = asset.name?.trim() || fallbackName;
  return toFile(buffer, filename, { type: mediaType });
};

const splitTextIntoChunks = (text: string) => {
  const normalized = text.replace(/\r/g, "");
  const paragraphs = normalized.split("\n");
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      chunks.push("\n");
      continue;
    }

    if (paragraph.length <= 96) {
      chunks.push(`${paragraph}\n`);
      continue;
    }

    for (let index = 0; index < paragraph.length; index += 96) {
      chunks.push(paragraph.slice(index, index + 96));
    }

    chunks.push("\n");
  }

  return chunks.filter(Boolean);
};

const jsonLine = (event: StreamEvent) => encoder.encode(`${JSON.stringify(event)}\n`);

const generateText = async (
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.7,
): Promise<TextGenerationResult> => {
  if (!textClient) {
    throw new Error("text client not configured");
  }

  const response = await textClient.chat.completions.create({
    model: textModel,
    temperature,
    max_tokens: 1800,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const text = extractCompletionText(response.choices?.[0]?.message?.content);

  if (!text) {
    throw new Error("empty text response");
  }

  return { text };
};

const buildImageGuidance = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();

  if (message.includes("must be verified")) {
    return "图片生成暂时不可用，请先完成组织验证后再试。";
  }

  if (message.includes("incorrect api key") || message.includes("invalid_api_key")) {
    return "图片生成配置异常，请检查图片生成密钥。";
  }

  if (message.includes("insufficient_quota") || message.includes("quota")) {
    return "图片生成额度不足，请补充后再试。";
  }

  if (message.includes("timeout") || message.includes("timed out")) {
    return "图片生成超时，已尝试重试但仍未完成。";
  }

  return "图片生成暂时不可用，请稍后重试。";
};

const buildTextFallbackResult = (payload: StudioPayload) => {
  const fallback = buildLocalFallback(payload);
  return {
    type: "text" as const,
    text: fallback.text,
    note: fallback.note,
    meta: extractResultMeta(payload, fallback.text),
  };
};

const generateReviewedText = async (
  payload: StudioPayload,
  onStatus?: (message: string) => Promise<void> | void,
): Promise<AssistantResult> => {
  const promptConfig = buildSkillInstructions(payload);

  if (!textClient) {
    return buildTextFallbackResult(payload);
  }

  try {
    await onStatus?.("正在整理需求");
    const draft = await withTimeout(
      generateText(promptConfig.systemPrompt, promptConfig.userPrompt),
      textTimeoutMs,
      "text-draft",
    );

    let finalText = draft.text;

    if (promptConfig.reviewSystemPrompt && promptConfig.buildReviewUserPrompt) {
      await onStatus?.("正在复核结果");
      const reviewed = await withTimeout(
        generateText(promptConfig.reviewSystemPrompt, promptConfig.buildReviewUserPrompt(draft.text), 0.4),
        textTimeoutMs,
        "text-review",
      );
      finalText = reviewed.text || draft.text;
    }

    return {
      type: "text",
      text: finalText,
      note:
        payload.skill === "xiaohongshu-biji"
          ? "已完成笔记生成，并按小红书正文语气复核。"
          : "已完成生成，并做过一轮内容复核。",
      meta: extractResultMeta(payload, finalText),
    };
  } catch (error) {
    logGenerationError("text-generation", error);
    return {
      ...buildTextFallbackResult(payload),
      note: "当前模型不稳定，已回退到本地可用版本。",
    };
  }
};

const generateImageOnce = async (prompt: string, size: "1024x1536" | "1536x1024", files: File[]) => {
  if (!imageClient) {
    throw new Error("image client not configured");
  }

  if (files.length) {
    const imageResponse = await withTimeout(
      imageClient.images.edit({
        model: imageModel,
        image: files.length === 1 ? files[0] : files,
        prompt,
        size,
        quality: "low",
        output_format: "png",
        input_fidelity: "high",
        background: "auto",
      }),
      imageTimeoutMs,
      "image-edit",
    );

    return imageResponse.data?.[0]?.b64_json || null;
  }

  const imageResponse = await withTimeout(
    imageClient.images.generate({
      model: imageModel,
      prompt,
      size,
      quality: "low",
      output_format: "png",
    }),
    imageTimeoutMs,
    "image-generate",
  );

  return imageResponse.data?.[0]?.b64_json || null;
};

const generateStableImage = async (
  payload: StudioPayload,
  prompt: string,
  size: "1024x1536" | "1536x1024",
) => {
  if (!imageEnabled || !imageClient) {
    return null;
  }

  const { logoAssets, referenceAssets } = collectImageAssets(payload);
  const allAssets = [...logoAssets, ...referenceAssets].slice(0, 12);
  const logoOnlyAssets = logoAssets.slice(0, 6);
  const lastErrors: unknown[] = [];

  const allFiles = (
    await Promise.all(allAssets.map((asset, index) => assetToFile(asset, index)))
  ).filter((file): file is File => Boolean(file));

  const logoFiles = (
    await Promise.all(logoOnlyAssets.map((asset, index) => assetToFile(asset, index)))
  ).filter((file): file is File => Boolean(file));

  const attempts: Array<{ label: string; files: File[] }> = [];

  if (allFiles.length > 0) {
    attempts.push({ label: "all-assets", files: allFiles });
  }

  if (logoFiles.length > 0 && logoFiles.length < allFiles.length) {
    attempts.push({ label: "logo-only", files: logoFiles });
  }

  attempts.push({ label: "text-only", files: [] });

  for (const attempt of attempts) {
    try {
      const imageBase64 = await generateImageOnce(prompt, size, attempt.files);
      if (imageBase64) {
        return imageBase64;
      }
    } catch (error) {
      lastErrors.push(error);
      logGenerationError(`image-${attempt.label}`, error);
      if (attempt.files.length > 0) {
        await sleep(600);
      }
    }
  }

  throw lastErrors[lastErrors.length - 1] || new Error("image generation failed");
};

const sanitizeSegment = (value: string) =>
  value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

const buildOutputBasename = (payload: StudioPayload) => {
  if (payload.skill === "chanping-toutu") {
    const parts = [payload.form.designType, payload.form.productName || payload.form.storeName]
      .map((part) => sanitizeSegment(part || ""))
      .filter(Boolean);
    return parts.join("-") || "产品图";
  }

  if (payload.skill === "xiaohongshu-biji") {
    const parts = ["小红书笔记图", payload.form.productName || payload.form.storeName]
      .map((part) => sanitizeSegment(part || ""))
      .filter(Boolean);
    return parts.join("-");
  }

  return "图片结果";
};

const ensureUniquePath = async (dir: string, baseName: string) => {
  const ext = ".png";
  const initialPath = path.join(dir, `${baseName}${ext}`);

  try {
    await stat(initialPath);
  } catch {
    return initialPath;
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[:T]/g, "-")
    .replace(/\..+$/, "");

  return path.join(dir, `${baseName}-${stamp}${ext}`);
};

const saveImageToDesktop = async (payload: StudioPayload, imageBase64: string) => {
  const desktopDir = path.join(os.homedir(), "Desktop");
  await mkdir(desktopDir, { recursive: true });
  const outputPath = await ensureUniquePath(desktopDir, buildOutputBasename(payload));
  await writeFile(outputPath, Buffer.from(imageBase64, "base64"));
  return outputPath;
};

const resolveImagePrompt = async (payload: StudioPayload, promptConfig: PromptConfig) => {
  const fallbackPrompt = buildLocalFallback(payload).text;

  if (!textClient) {
    return {
      prompt: fallbackPrompt,
      usedFallbackPrompt: true,
    };
  }

  try {
    const promptResult = await withTimeout(
      generateText(promptConfig.systemPrompt, promptConfig.userPrompt),
      textTimeoutMs,
      "image-prompt",
    );

    return {
      prompt: promptResult.text || fallbackPrompt,
      usedFallbackPrompt: false,
    };
  } catch {
    return {
      prompt: fallbackPrompt,
      usedFallbackPrompt: true,
    };
  }
};

const streamTextResponse = (payload: StudioPayload) =>
  new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        const push = (event: StreamEvent) => controller.enqueue(jsonLine(event));

        try {
          const result = await generateReviewedText(payload, async (message) => {
            push({ type: "status", message });
          });

          for (const chunk of splitTextIntoChunks(result.text)) {
            push({ type: "chunk", text: chunk });
            await sleep(18);
          }

          push({ type: "result", data: result });
        } catch (error) {
          const fallback = buildTextFallbackResult(payload);

          for (const chunk of splitTextIntoChunks(fallback.text)) {
            push({ type: "chunk", text: chunk });
          }

          push({
            type: "result",
            data: {
              ...fallback,
              note: error instanceof Error ? `模型不稳定，已回退可用结果。` : fallback.note,
            },
          });
        } finally {
          controller.close();
        }
      },
    }),
    {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    },
  );

export async function POST(request: Request) {
  let payload: StudioPayload;

  try {
    payload = (await request.json()) as StudioPayload;
  } catch {
    return NextResponse.json({ error: "缺少有效的请求内容。" }, { status: 400 });
  }

  if (!payload?.skill) {
    return NextResponse.json({ error: "缺少技能类型。" }, { status: 400 });
  }

  if (!payload?.form || typeof payload.form !== "object") {
    return NextResponse.json({ error: "缺少表单参数。" }, { status: 400 });
  }

  const wantsStream = request.headers.get("x-stream-text") === "1";

  if (!isImagePayload(payload) && wantsStream) {
    return streamTextResponse(payload);
  }

  const promptConfig = buildSkillInstructions(payload);

  if (!textClient && !imageClient) {
    return NextResponse.json(buildLocalFallback(payload));
  }

  try {
    if (!isImagePayload(payload)) {
      const result = await generateReviewedText(payload);
      return NextResponse.json(result);
    }

    const { prompt, usedFallbackPrompt } = await resolveImagePrompt(payload, promptConfig);

    if (!imageEnabled || !imageClient) {
      return NextResponse.json({
        type: "prompt",
        note: "当前无法直接生成图片，已返回最终生图提示词。",
        text: prompt,
      });
    }

    const imageBase64 = await generateStableImage(payload, prompt, promptConfig.imageSize || "1536x1024");

    if (!imageBase64) {
      return NextResponse.json({
        type: "prompt",
        note: "图片生成没有返回结果，已返回最终生图提示词。",
        text: prompt,
      });
    }

    let savedPath = "";

    try {
      savedPath = await saveImageToDesktop(payload, imageBase64);
    } catch {
      savedPath = "";
    }

    return NextResponse.json({
      type: "image",
      note: `${promptConfig.successNote || "已完成图片生成。"}${usedFallbackPrompt ? " 本次已自动使用回退提示词继续出图。" : ""}${savedPath ? " 文件已保存到桌面。" : ""}`,
      text: prompt,
      imageDataUrl: `data:image/png;base64,${imageBase64}`,
      actions: savedPath ? [`桌面文件：${savedPath}`] : undefined,
    });
  } catch (error) {
    if (isImagePayload(payload)) {
      logGenerationError("image-result", error);
      const fallback = buildLocalFallback(payload);
      return NextResponse.json({
        type: fallback.type,
        text: fallback.text,
        note: buildImageGuidance(error),
      });
    }

    logGenerationError("text-result", error);
    const fallback = buildTextFallbackResult(payload);
    return NextResponse.json({
      ...fallback,
      note: "模型不稳定，已返回本地兜底版本。",
    });
  }
}
