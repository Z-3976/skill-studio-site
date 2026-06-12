import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";
import {
  buildLocalFallback,
  buildSkillInstructions,
  type StudioPayload,
  type UploadAsset,
} from "@/lib/skill-prompts";

export const runtime = "nodejs";

type TextGenerationResult = {
  text: string;
  model: string;
};

const deepSeekTextModel = process.env.DEEPSEEK_TEXT_MODEL?.trim() || "deepseek-v4-flash";
const deepSeekBaseUrl = process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com";
const imageModel = "gpt-image-2";
const textTimeoutMs = 45_000;
const imageTimeoutMs = 75_000;

const imageEnabled =
  process.env.ENABLE_IMAGE_GENERATION === "true" || process.env.ENABLE_IMAGE_GENERATION === "1";

const deepSeekClient = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: deepSeekBaseUrl,
    })
  : null;

const openAiImageClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "生成失败，请稍后再试。";

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string) =>
  Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
    }),
  ]);

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
  if (mediaType.includes("png")) {
    return "png";
  }

  if (mediaType.includes("webp")) {
    return "webp";
  }

  if (mediaType.includes("jpeg") || mediaType.includes("jpg")) {
    return "jpg";
  }

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
      note: "OpenAI 生图通道暂时不可用，已回退为最终生图提示词。",
      actions: [
        "去 OpenAI 平台完成组织验证。",
        "验证完成后等待约 10 到 15 分钟，再重新生成。",
      ],
    };
  }

  if (message.includes("incorrect api key") || message.includes("invalid_api_key")) {
    return {
      note: "OpenAI 生图 Key 无效，已回退为最终生图提示词。",
      actions: ["检查 Vercel 里的 OPENAI_API_KEY 是否正确。"],
    };
  }

  if (message.includes("insufficient_quota") || message.includes("quota")) {
    return {
      note: "OpenAI 生图额度不足，已回退为最终生图提示词。",
      actions: ["检查 OpenAI 账户额度或套餐状态。"],
    };
  }

  if (message.includes("timeout") || message.includes("connection")) {
    return {
      note: "OpenAI 生图连接超时，已回退为最终生图提示词。",
      actions: ["稍后重试一次。"],
    };
  }

  return {
    note: "OpenAI 生图暂时不可用，已回退为最终生图提示词。",
    actions: ["稍后重试，或检查 OpenAI 图片权限与环境变量配置。"],
  };
};

const generateTextWithDeepSeek = async (
  systemPrompt: string,
  userPrompt: string,
): Promise<TextGenerationResult> => {
  if (!deepSeekClient) {
    throw new Error("DeepSeek text client is not configured.");
  }

  const response = await deepSeekClient.chat.completions.create({
    model: deepSeekTextModel,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const text = extractCompletionText(response.choices?.[0]?.message?.content);

  if (!text) {
    throw new Error(`DeepSeek (${deepSeekTextModel}) returned an empty response.`);
  }

  return {
    text,
    model: deepSeekTextModel,
  };
};

export async function POST(request: Request) {
  let payload: StudioPayload;

  try {
    payload = (await request.json()) as StudioPayload;
  } catch {
    return NextResponse.json({ error: "缺少有效的 JSON 请求体。" }, { status: 400 });
  }

  if (!payload?.skill) {
    return NextResponse.json({ error: "缺少 skill 参数。" }, { status: 400 });
  }

  if (!payload?.form || typeof payload.form !== "object") {
    return NextResponse.json({ error: "缺少 form 参数。" }, { status: 400 });
  }

  if (!deepSeekClient && !openAiImageClient) {
    return NextResponse.json(buildLocalFallback(payload));
  }

  try {
    const promptConfig = buildSkillInstructions(payload);

    if (payload.skill === "chanping-toutu") {
      if (!deepSeekClient) {
        return NextResponse.json({
          ...buildLocalFallback(payload),
          note: "当前未配置 DeepSeek 文本通道，已返回最终生图提示词。",
        });
      }

      const promptResult = await withTimeout(
        generateTextWithDeepSeek(promptConfig.systemPrompt, promptConfig.userPrompt),
        textTimeoutMs,
        "deepseek-visual-prompt",
      );

      const finalPrompt = promptResult.text || "最终生图提示词：请根据用户信息生成高级商业产品头图。";

      if (!imageEnabled) {
        return NextResponse.json({
          type: "prompt",
          note: "当前环境未开启图片生成，已返回最终生图提示词。",
          text: finalPrompt,
        });
      }

      if (!openAiImageClient) {
        return NextResponse.json({
          type: "prompt",
          note: "当前未配置 OpenAI 生图通道，已返回最终生图提示词。",
          text: finalPrompt,
        });
      }

      const logoAssets = extractAssets(payload.form.logoAssets);
      const referenceAssets = extractAssets(payload.form.referenceAssets);
      const visualAssets = [...logoAssets, ...referenceAssets].slice(0, 16);

      try {
        let imageBase64: string | null = null;
        const ktLayout = isKtLayout(payload.form.designType);

        if (visualAssets.length) {
          const imageFiles = (
            await Promise.all(visualAssets.map((asset, index) => assetToFile(asset, index)))
          ).filter((file): file is File => Boolean(file));

          if (imageFiles.length) {
            const imageResponse = await withTimeout(
              openAiImageClient.images.edit({
                model: imageModel,
                image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
                prompt: finalPrompt,
                size: getVisualImageSize(payload.form.designType),
                quality: "high",
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
            openAiImageClient.images.generate({
              model: imageModel,
              prompt: finalPrompt,
              size: getVisualImageSize(payload.form.designType),
              quality: "high",
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
            note: "图片通道没有返回图片，已回退为最终生图提示词。",
            text: finalPrompt,
          });
        }

        return NextResponse.json({
          type: "image",
          note: visualAssets.length
            ? ktLayout
              ? "已结合上传 Logo / 参考图生成；KT 板按竖版物料逻辑执行。"
              : "已结合上传 Logo / 参考图生成；头图按 4:3 + 中间 1:1 安全区执行。"
            : ktLayout
              ? "已按竖版 KT 物料逻辑出图。"
              : "已按 4:3 + 中间 1:1 安全区执行。",
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

    if (!deepSeekClient) {
      return NextResponse.json({
        ...buildLocalFallback(payload),
        note: "当前未配置 DeepSeek 文本通道，已回退为本地结果。",
      });
    }

    const textResult = await withTimeout(
      generateTextWithDeepSeek(promptConfig.systemPrompt, promptConfig.userPrompt),
      textTimeoutMs,
      "deepseek-text",
    );

    return NextResponse.json({
      type: "text",
      text: textResult.text,
      note: `已由 DeepSeek ${textResult.model} 生成。`,
    });
  } catch {
    const fallback = buildLocalFallback(payload);

    return NextResponse.json({
      ...fallback,
      note: payload.skill === "chanping-toutu" ? "DeepSeek 暂时不可用，已返回最终生图提示词。" : "DeepSeek 暂时不可用，已回退为本地结果。",
    });
  }
}
