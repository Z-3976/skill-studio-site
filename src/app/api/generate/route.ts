import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  buildLocalFallback,
  buildSkillInstructions,
  type StudioPayload,
} from "@/lib/skill-prompts";

export const runtime = "nodejs";

type TextGenerationResult = {
  text: string;
  model: string;
};

const deepSeekTextModel = process.env.DEEPSEEK_TEXT_MODEL?.trim() || "deepseek-v4-flash";
const deepSeekBaseUrl = process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com";
const imageModel = "gpt-image-2";

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

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "生成失败，请稍后重试。";

const buildImageFallbackGuidance = (error: unknown) => {
  const message = getErrorMessage(error);
  const lowered = message.toLowerCase();

  if (message.includes("must be verified")) {
    return {
      note: `OpenAI 生图通道暂时不可用，已回退为最终生图提示词。原因：当前组织尚未完成 ${imageModel} 所需验证。`,
      actions: [
        "前往 OpenAI 平台完成 Organization Verify。",
        "验证完成后等待约 10 到 15 分钟，再回到网站重新生成。",
      ],
    };
  }

  if (lowered.includes("incorrect api key") || lowered.includes("invalid_api_key")) {
    return {
      note: "OpenAI 生图通道的 API Key 无效，已回退为最终生图提示词。",
      actions: [
        "检查 Vercel 环境变量里的 OPENAI_API_KEY 是否填写正确。",
        "如刚更新过 Key，重新部署一次网站再试。",
      ],
    };
  }

  if (lowered.includes("insufficient_quota") || lowered.includes("quota")) {
    return {
      note: "OpenAI 生图通道额度不足，已回退为最终生图提示词。",
      actions: [
        "检查 OpenAI 账户余额、套餐或额度限制。",
        "补充额度后重新生成。",
      ],
    };
  }

  if (lowered.includes("timeout") || lowered.includes("connection")) {
    return {
      note: "OpenAI 生图通道连接超时，已回退为最终生图提示词。",
      actions: [
        "稍后再试一次。",
        "如果持续失败，检查 Vercel 环境变量和 OpenAI 账户状态。",
      ],
    };
  }

  return {
    note: `OpenAI 生图通道暂时不可用，已回退为最终生图提示词。原因：${message}`,
    actions: [
      "稍后再试一次。",
      "如果问题持续，检查 OpenAI Key、模型权限和环境变量配置。",
    ],
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
          note: "当前未配置 DeepSeek 文本通道，已回退为本地结果。",
        });
      }

      const promptResult = await generateTextWithDeepSeek(
        promptConfig.systemPrompt,
        promptConfig.userPrompt,
      );

      const finalPrompt =
        promptResult.text || "最终生图提示词：请根据用户信息生成高级商业产品头图。";

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
          note: "当前缺少 OpenAI 生图通道，已返回最终生图提示词。",
          text: finalPrompt,
        });
      }

      try {
        const imageResponse = await openAiImageClient.images.generate({
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
          note: "已按 4:3 + 中间 1:1 安全区执行；KT板按竖版宣传物料逻辑组织。",
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

    const textResult = await generateTextWithDeepSeek(
      promptConfig.systemPrompt,
      promptConfig.userPrompt,
    );

    return NextResponse.json({
      type: "text",
      text: textResult.text,
    });
  } catch (error) {
    const fallback = buildLocalFallback(payload);

    return NextResponse.json({
      ...fallback,
      note: `DeepSeek 文本通道暂时不可用，已回退为本地结果。原因：${getErrorMessage(error)}`,
    });
  }
}
