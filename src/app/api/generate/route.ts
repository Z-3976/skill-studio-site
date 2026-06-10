import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  buildLocalFallback,
  buildSkillInstructions,
  type StudioPayload,
  type UploadAsset,
} from "@/lib/skill-prompts";

export const runtime = "nodejs";

const textModel = process.env.OPENAI_TEXT_MODEL || "gpt-4.1";
const configuredImageModel = process.env.OPENAI_IMAGE_MODEL?.trim();
const imageModel =
  configuredImageModel &&
  /^(gpt-image-|chatgpt-image-latest|dall-e-)/.test(configuredImageModel)
    ? configuredImageModel
    : "gpt-image-1";

const imageEnabled =
  process.env.ENABLE_IMAGE_GENERATION === "true" || process.env.ENABLE_IMAGE_GENERATION === "1";

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

const extractOutputText = (response: { output_text?: string }) => response.output_text?.trim() || "";

const getVisualImageSize = (designType: StudioPayload["form"][string]) =>
  typeof designType === "string" && designType.includes("KT") ? "1024x1536" : "1536x1024";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "生成失败，请稍后重试。";

const getFallbackGuidance = (error: unknown, model: string) => {
  const message = getErrorMessage(error);
  const lowered = message.toLowerCase();

  if (message.includes("must be verified")) {
    return {
      note: `当前配置的 OpenAI 组织还没有完成验证，暂时不能调用 ${model}，已自动回退为本地结果。`,
      actions: [
        "前往 OpenAI 平台的 Organization Settings 完成 Verify Organization。",
        "验证完成后等待约 10 到 15 分钟，再回到网站重新生成。",
        "如果你想先继续用，现在右侧给出的“最终生图提示词”可以直接拿去生图。",
      ],
    };
  }

  if (lowered.includes("incorrect api key") || lowered.includes("invalid_api_key")) {
    return {
      note: "当前配置的 OpenAI API Key 无效，已自动回退为本地结果。",
      actions: [
        "检查 Vercel 环境变量里的 OPENAI_API_KEY 是否填写正确。",
        "如果刚更新过 Key，重新部署一次网站再试。",
      ],
    };
  }

  if (lowered.includes("insufficient_quota") || lowered.includes("quota")) {
    return {
      note: "当前 OpenAI 账户额度不足，已自动回退为本地结果。",
      actions: [
        "检查 OpenAI 账户余额、套餐或额度限制。",
        "补充额度后重新生成。",
      ],
    };
  }

  if (lowered.includes("connection error") || lowered.includes("timeout")) {
    return {
      note: "OpenAI 连接超时或网络不稳定，已自动回退为本地结果。",
      actions: [
        "稍后重试一次。",
        "如果持续出现，检查 Vercel 部署区域或更换可用的模型配置。",
      ],
    };
  }

  return {
    note: `OpenAI 暂时不可用，已自动回退为本地结果。原因：${message}`,
    actions: [
      "稍后再试一次。",
      "如果问题持续出现，检查 OpenAI Key、模型权限和 Vercel 环境变量配置。",
    ],
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

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(buildLocalFallback(payload));
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const promptConfig = buildSkillInstructions(payload);

    if (payload.skill === "chanping-toutu") {
      const logoAssets = ((payload.form.logoAssets as UploadAsset[]) || []).filter(Boolean);
      const referenceAssets = ((payload.form.referenceAssets as UploadAsset[]) || []).filter(Boolean);

      const promptResponse = await client.responses.create({
        model: textModel,
        instructions: promptConfig.systemPrompt,
        input: [
          {
            role: "user",
            content: getImageContent(promptConfig.userPrompt, logoAssets, referenceAssets) as never,
          },
        ],
      });

      const finalPrompt =
        extractOutputText(promptResponse) || "最终生图提示词：请根据用户信息生成高级商业产品头图。";

      if (!imageEnabled) {
        return NextResponse.json({
          type: "prompt",
          note: "当前环境未开启图像生成，已返回最终生图提示词。",
          text: finalPrompt,
        });
      }

      try {
        const imageResponse = await client.images.generate({
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
            note: "图像生成未返回图片，已回退为最终提示词。",
            text: finalPrompt,
          });
        }

        return NextResponse.json({
          type: "image",
          note: "已按 4:3 + 中间 1:1 安全区执行；KT板任务则按竖版宣传板逻辑组织。",
          text: finalPrompt,
          imageDataUrl: `data:image/png;base64,${imageBase64}`,
        });
      } catch (error) {
        const guidance = getFallbackGuidance(error, imageModel);

        return NextResponse.json({
          type: "prompt",
          note: guidance.note,
          actions: guidance.actions,
          text: finalPrompt,
        });
      }
    }

    const response = await client.responses.create({
      model: textModel,
      instructions: promptConfig.systemPrompt,
      input: promptConfig.userPrompt,
    });

    return NextResponse.json({
      type: "text",
      text: extractOutputText(response),
    });
  } catch (error) {
    const fallback = buildLocalFallback(payload);
    const guidance = getFallbackGuidance(error, textModel);

    return NextResponse.json({
      ...fallback,
      note: guidance.note,
      actions: guidance.actions,
    });
  }
}
