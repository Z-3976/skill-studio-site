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
const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-4.1";

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

const extractImageBase64 = (response: { output?: Array<{ type?: string; result?: unknown }> }) => {
  const imageCall = response.output?.find((item) => item.type === "image_generation_call");
  const result = imageCall?.result;
  return typeof result === "string" ? result : null;
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

      const imageResponse = await client.responses.create({
        model: imageModel,
        input: [
          {
            role: "user",
            content: getImageContent(finalPrompt, logoAssets, referenceAssets) as never,
          },
        ],
        tools: [{ type: "image_generation" }],
      });

      const imageBase64 = extractImageBase64(imageResponse);

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
    const message = error instanceof Error ? error.message : "生成失败，请稍后重试。";

    return NextResponse.json({
      ...fallback,
      note: `OpenAI 暂时不可用，已自动回退为本地结果。原因：${message}`,
    });
  }
}
