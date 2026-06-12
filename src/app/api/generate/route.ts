import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  buildLocalFallback,
  buildSkillInstructions,
  type StudioPayload,
  type UploadAsset,
} from "@/lib/skill-prompts";

export const runtime = "nodejs";

type TextProvider = "openai" | "deepseek";

type TextGenerationRequest = {
  systemPrompt: string;
  userPrompt: string;
  multimodalContent?: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string }
  >;
};

type TextGenerationResult = {
  text: string;
  provider: TextProvider;
  model: string;
};

const openAiTextModel = process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4.1";
const deepSeekTextModel = process.env.DEEPSEEK_TEXT_MODEL?.trim() || "deepseek-v4-flash";
const deepSeekBaseUrl = process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com";
const imageModel = "gpt-image-2";

const imageEnabled =
  process.env.ENABLE_IMAGE_GENERATION === "true" || process.env.ENABLE_IMAGE_GENERATION === "1";

const openAiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const deepSeekClient = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: deepSeekBaseUrl,
    })
  : null;

const getImageContent = (
  prompt: string,
  logoAssets: UploadAsset[],
  referenceAssets: UploadAsset[],
) => {
  const content = [{ type: "input_text", text: prompt }] as Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string }
  >;

  for (const asset of logoAssets) {
    content.push({
      type: "input_image",
      image_url: asset.dataUrl,
    });
  }

  for (const asset of referenceAssets) {
    content.push({
      type: "input_image",
      image_url: asset.dataUrl,
    });
  }

  return content;
};

const extractResponseText = (response: { output_text?: string }) => response.output_text?.trim() || "";

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

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Generation failed. Please try again later.";

const buildImageFallbackGuidance = (error: unknown) => {
  const message = getErrorMessage(error);
  const lowered = message.toLowerCase();

  if (message.includes("must be verified")) {
    return {
      note: `OpenAI 图片通道暂时不可用，已回退为最终生图提示词。原因：当前组织尚未完成 ${imageModel} 所需验证。`,
      actions: [
        "前往 OpenAI 平台完成 Organization Verify。",
        "验证完成后等待约 10 到 15 分钟，再回到网站重新生成。",
      ],
    };
  }

  if (lowered.includes("incorrect api key") || lowered.includes("invalid_api_key")) {
    return {
      note: "OpenAI 图片通道的 API Key 无效，已回退为最终生图提示词。",
      actions: [
        "检查 Vercel 环境变量里的 OPENAI_API_KEY 是否填写正确。",
        "如刚更新过 Key，重新部署一次网站再试。",
      ],
    };
  }

  if (lowered.includes("insufficient_quota") || lowered.includes("quota")) {
    return {
      note: "OpenAI 图片通道额度不足，已回退为最终生图提示词。",
      actions: [
        "检查 OpenAI 账户余额、套餐或额度限制。",
        "补充额度后重新生成。",
      ],
    };
  }

  if (lowered.includes("timeout") || lowered.includes("connection")) {
    return {
      note: "OpenAI 图片通道连接超时，已回退为最终生图提示词。",
      actions: [
        "稍后再试一次。",
        "如果持续失败，检查 Vercel 环境变量和 OpenAI 账户状态。",
      ],
    };
  }

  return {
    note: `OpenAI 图片通道暂时不可用，已回退为最终生图提示词。原因：${message}`,
    actions: [
      "稍后再试一次。",
      "如果问题持续，检查 OpenAI Key、模型权限和环境变量配置。",
    ],
  };
};

const generateTextWithOpenAI = async (
  request: TextGenerationRequest,
): Promise<TextGenerationResult> => {
  if (!openAiClient) {
    throw new Error("OpenAI text client is not configured.");
  }

  const response = await openAiClient.responses.create({
    model: openAiTextModel,
    instructions: request.systemPrompt,
    input: request.multimodalContent
      ? [
          {
            role: "user",
            content: request.multimodalContent as never,
          },
        ]
      : request.userPrompt,
  });

  const text = extractResponseText(response);

  if (!text) {
    throw new Error(`OpenAI (${openAiTextModel}) returned an empty response.`);
  }

  return {
    text,
    provider: "openai",
    model: openAiTextModel,
  };
};

const generateTextWithDeepSeek = async (
  request: TextGenerationRequest,
): Promise<TextGenerationResult> => {
  if (!deepSeekClient) {
    throw new Error("DeepSeek text client is not configured.");
  }

  const response = await deepSeekClient.chat.completions.create({
    model: deepSeekTextModel,
    messages: [
      {
        role: "system",
        content: request.systemPrompt,
      },
      {
        role: "user",
        content: request.userPrompt,
      },
    ],
  });

  const text = extractCompletionText(response.choices?.[0]?.message?.content);

  if (!text) {
    throw new Error(`DeepSeek (${deepSeekTextModel}) returned an empty response.`);
  }

  return {
    text,
    provider: "deepseek",
    model: deepSeekTextModel,
  };
};

const generateText = async (request: TextGenerationRequest): Promise<TextGenerationResult> => {
  const failures: Array<{ provider: TextProvider; model: string; message: string }> = [];

  if (openAiClient) {
    try {
      return await generateTextWithOpenAI(request);
    } catch (error) {
      failures.push({
        provider: "openai",
        model: openAiTextModel,
        message: getErrorMessage(error),
      });
    }
  }

  if (deepSeekClient) {
    try {
      return await generateTextWithDeepSeek(request);
    } catch (error) {
      failures.push({
        provider: "deepseek",
        model: deepSeekTextModel,
        message: getErrorMessage(error),
      });
    }
  }

  if (!failures.length) {
    throw new Error("No text model is configured.");
  }

  throw new Error(
    failures.map((failure) => `${failure.provider}(${failure.model}): ${failure.message}`).join(" | "),
  );
};

export async function POST(request: Request) {
  let payload: StudioPayload;

  try {
    payload = (await request.json()) as StudioPayload;
  } catch {
    return NextResponse.json({ error: "Missing a valid JSON request body." }, { status: 400 });
  }

  if (!payload?.skill) {
    return NextResponse.json({ error: "Missing skill parameter." }, { status: 400 });
  }

  if (!payload?.form || typeof payload.form !== "object") {
    return NextResponse.json({ error: "Missing form parameter." }, { status: 400 });
  }

  if (!openAiClient && !deepSeekClient) {
    return NextResponse.json(buildLocalFallback(payload));
  }

  try {
    const promptConfig = buildSkillInstructions(payload);

    if (payload.skill === "chanping-toutu") {
      const logoAssets = ((payload.form.logoAssets as UploadAsset[]) || []).filter(Boolean);
      const referenceAssets = ((payload.form.referenceAssets as UploadAsset[]) || []).filter(Boolean);

      const promptResult = await generateText({
        systemPrompt: promptConfig.systemPrompt,
        userPrompt: promptConfig.userPrompt,
        multimodalContent: openAiClient
          ? getImageContent(promptConfig.userPrompt, logoAssets, referenceAssets)
          : undefined,
      });

      const finalPrompt =
        promptResult.text || "最终生图提示词：请根据用户信息生成高级商业产品头图。";

      if (!imageEnabled) {
        return NextResponse.json({
          type: "prompt",
          note: "当前环境未开启图片生成，已返回最终生图提示词。",
          text: finalPrompt,
        });
      }

      if (!openAiClient) {
        return NextResponse.json({
          type: "prompt",
          note: "当前缺少 OpenAI 生图通道，已返回最终生图提示词。",
          text: finalPrompt,
        });
      }

      try {
        const imageResponse = await openAiClient.images.generate({
          model: imageModel,
          prompt: finalPrompt,
          size: getVisualImageSize(payload.form.designType),
          quality: "high",
          output_format: "png",
        });

        const imageBase64 = imageResponse.data?.[0]?.b64_json || null;

        if (!imageBase64) {
          return NextResponse.json({
            type: "prompt",
            note: "图片通道没有返回图片，已回退为最终生图提示词。",
            text: finalPrompt,
          });
        }

        return NextResponse.json({
          type: "image",
          note:
            promptResult.provider === "deepseek"
              ? "提示词已由 DeepSeek 兜底生成，图片按 4:3 + 中间 1:1 安全区执行；KT板按竖版宣传物料逻辑组织。"
              : "已按 4:3 + 中间 1:1 安全区执行；KT板任务按竖版宣传物料逻辑组织。",
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

    const textResult = await generateText({
      systemPrompt: promptConfig.systemPrompt,
      userPrompt: promptConfig.userPrompt,
    });

    return NextResponse.json({
      type: "text",
      note:
        textResult.provider === "deepseek"
          ? `OpenAI 文本通道不可用，已自动切换到 DeepSeek（${textResult.model}）。`
          : undefined,
      text: textResult.text,
    });
  } catch (error) {
    const fallback = buildLocalFallback(payload);

    return NextResponse.json({
      ...fallback,
      note: `文本模型暂时不可用，已回退为本地结果。原因：${getErrorMessage(error)}`,
    });
  }
}
