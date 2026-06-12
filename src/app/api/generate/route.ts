import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";
import {
  buildLocalFallback,
  buildSkillInstructions,
  type StudioPayload,
  type UploadAsset,
} from "@/lib/skill-prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

type TextGenerationResult = {
  text: string;
};

const textModel = process.env.DEEPSEEK_TEXT_MODEL?.trim() || "deepseek-v4-flash";
const textBaseUrl = process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com";
const imageModel = "gpt-image-2";
const textTimeoutMs = 6_000;
const imageTimeoutMs = 10_000;

const imageEnabled =
  process.env.ENABLE_IMAGE_GENERATION === "true" || process.env.ENABLE_IMAGE_GENERATION === "1";

const textClient = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: textBaseUrl,
    })
  : null;

const imageClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "生成失败，请稍后重试。";

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string) =>
  Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
    }),
  ]);

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

const getVisualImageSize = (designType: StudioPayload["form"][string]) =>
  typeof designType === "string" && designType.includes("KT") ? "1024x1536" : "1536x1024";

const isKtLayout = (designType: StudioPayload["form"][string]) =>
  typeof designType === "string" && designType.includes("KT");

const extractAssets = (value: StudioPayload["form"][string]) =>
  Array.isArray(value)
    ? value.filter(
        (item): item is UploadAsset =>
          Boolean(
            item &&
              typeof item === "object" &&
              "dataUrl" in item &&
              typeof item.dataUrl === "string" &&
              "name" in item &&
              typeof item.name === "string",
          ),
      )
    : [];

const inferExtension = (mediaType: string) => {
  if (mediaType.includes("png")) return "png";
  if (mediaType.includes("webp")) return "webp";
  if (mediaType.includes("jpeg") || mediaType.includes("jpg")) return "jpg";
  return "png";
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

const buildImageFallbackGuidance = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();

  if (message.includes("must be verified")) {
    return {
      note: "图片生成暂时不可用，已返回最终生图提示词。",
      actions: ["稍后重试，如多次失败请检查图片生成配置。"],
    };
  }

  if (message.includes("incorrect api key") || message.includes("invalid_api_key")) {
    return {
      note: "图片生成配置异常，已返回最终生图提示词。",
      actions: ["请检查图片生成配置后再试。"],
    };
  }

  if (message.includes("insufficient_quota") || message.includes("quota")) {
    return {
      note: "图片生成额度不足，已返回最终生图提示词。",
      actions: ["请检查当前图片生成额度。"],
    };
  }

  if (message.includes("timeout") || message.includes("connection")) {
    return {
      note: "图片生成超时，已返回最终生图提示词。",
      actions: ["稍后重试一次。"],
    };
  }

  return {
    note: "图片生成暂时不可用，已返回最终生图提示词。",
    actions: ["请稍后重试。"],
  };
};

const generateText = async (
  systemPrompt: string,
  userPrompt: string,
): Promise<TextGenerationResult> => {
  if (!textClient) {
    throw new Error("text client not configured");
  }

  const response = await textClient.chat.completions.create({
    model: textModel,
    temperature: 0.7,
    max_tokens: 1200,
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

export async function POST(request: Request) {
  let payload: StudioPayload;

  try {
    payload = (await request.json()) as StudioPayload;
  } catch {
    return NextResponse.json({ error: "缺少有效的请求内容。" }, { status: 400 });
  }

  if (!payload?.skill) {
    return NextResponse.json({ error: "缺少类型参数。" }, { status: 400 });
  }

  if (!payload?.form || typeof payload.form !== "object") {
    return NextResponse.json({ error: "缺少表单参数。" }, { status: 400 });
  }

  if (!textClient && !imageClient) {
    return NextResponse.json(buildLocalFallback(payload));
  }

  try {
    const promptConfig = buildSkillInstructions(payload);

    if (payload.skill === "chanping-toutu") {
      if (!textClient) {
        return NextResponse.json({
          ...buildLocalFallback(payload),
          note: "当前无法生成图片，已返回最终生图提示词。",
        });
      }

      const promptResult = await withTimeout(
        generateText(promptConfig.systemPrompt, promptConfig.userPrompt),
        textTimeoutMs,
        "visual-prompt",
      );

      const finalPrompt = promptResult.text || "最终生图提示词：请根据用户信息生成商业宣传图。";

      if (!imageEnabled || !imageClient) {
        return NextResponse.json({
          type: "prompt",
          note: "当前无法直接出图，已返回最终生图提示词。",
          text: finalPrompt,
        });
      }

      const logoAssets = extractAssets(payload.form.logoAssets);
      const referenceAssets = extractAssets(payload.form.referenceAssets);
      const visualAssets = [...logoAssets, ...referenceAssets].slice(0, 16);

      try {
        let imageBase64: string | null = null;

        if (visualAssets.length) {
          const imageFiles = (
            await Promise.all(visualAssets.map((asset, index) => assetToFile(asset, index)))
          ).filter((file): file is File => Boolean(file));

          if (imageFiles.length) {
            const imageResponse = await withTimeout(
              imageClient.images.edit({
                model: imageModel,
                image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
                prompt: finalPrompt,
                size: getVisualImageSize(payload.form.designType),
                quality: "medium",
                output_format: "png",
                input_fidelity: "high",
                background: "auto",
              }),
              imageTimeoutMs,
              "image-edit",
            );

            imageBase64 = imageResponse.data?.[0]?.b64_json || null;
          }
        }

        if (!imageBase64) {
          const imageResponse = await withTimeout(
            imageClient.images.generate({
              model: imageModel,
              prompt: finalPrompt,
              size: getVisualImageSize(payload.form.designType),
              quality: "medium",
              output_format: "png",
            }),
            imageTimeoutMs,
            "image-generate",
          );

          imageBase64 = imageResponse.data?.[0]?.b64_json || null;
        }

        if (!imageBase64) {
          return NextResponse.json({
            type: "prompt",
            note: "图片生成没有返回结果，已返回最终生图提示词。",
            text: finalPrompt,
          });
        }

        return NextResponse.json({
          type: "image",
          note: isKtLayout(payload.form.designType)
            ? "已按竖版版式生成。"
            : "已按 4:3 和中间安全区生成。",
          text: finalPrompt,
          imageDataUrl: `data:image/png;base64,${imageBase64}`,
        });
      } catch (error) {
        const guidance = buildImageFallbackGuidance(error);

        return NextResponse.json({
          type: "prompt",
          note: guidance.note,
          actions: guidance.actions,
          text: finalPrompt,
        });
      }
    }

    if (!textClient) {
      return NextResponse.json({
        ...buildLocalFallback(payload),
        note: "当前生成暂时不可用，已返回基础结果。",
      });
    }

    const textResult = await withTimeout(
      generateText(promptConfig.systemPrompt, promptConfig.userPrompt),
      textTimeoutMs,
      "text-generate",
    );

    return NextResponse.json({
      type: "text",
      text: textResult.text,
    });
  } catch {
    const fallback = buildLocalFallback(payload);

    return NextResponse.json({
      ...fallback,
      note: payload.skill === "chanping-toutu" ? "当前无法出图，已返回最终生图提示词。" : "当前生成超时，已返回基础结果。",
    });
  }
}
