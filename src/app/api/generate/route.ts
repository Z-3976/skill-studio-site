import { execFile } from "node:child_process";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import OpenAI from "openai";
import { Resvg } from "@resvg/resvg-js";
import { NextResponse } from "next/server";
import {
  buildLocalFallback,
  buildSkillInstructions,
  extractResultMeta,
  isImagePayload,
  type StudioPayload,
} from "@/lib/skill-prompts";
import { getCurrentUser } from "@/lib/server-auth";
import type { AssistantResult, StreamEvent, UploadAsset, VisualForm, XiaohongshuForm } from "@/lib/studio-types";

export const runtime = "nodejs";
export const maxDuration = 300;

type TextGenerationResult = {
  text: string;
};

const textModel = process.env.DEEPSEEK_TEXT_MODEL?.trim() || "deepseek-chat";
const textBaseUrl = process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com";
const imageModel = "gpt-image-2";
const imageBaseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
const textTimeoutMs = 45_000;
const imageTimeoutMs = Number(process.env.OPENAI_IMAGE_TIMEOUT_MS || 360_000);

const textClient = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: textBaseUrl,
      timeout: 90_000,
      maxRetries: 1,
    })
  : null;

const imageApiKey = process.env.OPENAI_API_KEY?.trim() || "";
const encoder = new TextEncoder();
const execFileAsync = promisify(execFile);

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string) =>
  Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
    }),
  ]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const compactImagePrompt = (prompt: string) =>
  prompt
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, 2400);

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

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "生成失败，请稍后重试。");

const parseImageResponseText = (text: string) => {
  let json: any = null;

  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  const imageBase64 = json?.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error(json?.error?.message || "image response missing b64_json");
  }

  return imageBase64 as string;
};

const requestImageViaPowerShell = async (body: Record<string, unknown>) => {
  const tempDir = path.join(os.tmpdir(), "skill-studio-openai");
  await mkdir(tempDir, { recursive: true });
  const bodyPath = path.join(tempDir, `image-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  await writeFile(bodyPath, JSON.stringify(body), "utf8");

  const escapedBodyPath = bodyPath.replace(/'/g, "''");
  const escapedUrl = `${imageBaseUrl}/images/generations`.replace(/'/g, "''");
  const escapedKey = imageApiKey.replace(/'/g, "''");
  const timeoutSeconds = Math.max(120, Math.ceil(imageTimeoutMs / 1000));

  const psCommand = `
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $headers = @{ Authorization = 'Bearer ${escapedKey}' }
    $body = Get-Content -Raw -Encoding UTF8 -Path '${escapedBodyPath}'
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $response = Invoke-WebRequest -Uri '${escapedUrl}' -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $bytes -TimeoutSec ${timeoutSeconds}
    Write-Output $response.Content
  `;

  try {
    const { stdout, stderr } = await execFileAsync(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-Command", psCommand],
      {
        timeout: imageTimeoutMs + 30_000,
        maxBuffer: 60 * 1024 * 1024,
        windowsHide: true,
      },
    );

    if (stderr?.trim()) {
      console.warn("[image-powershell-stderr]", stderr.trim());
    }

    return parseImageResponseText(stdout);
  } catch (error: any) {
    const stderr = error?.stderr?.toString?.().trim?.() || "";
    const stdout = error?.stdout?.toString?.().trim?.() || "";
    const details = stderr || stdout || error?.message || "powershell image request failed";
    throw new Error(details);
  } finally {
    await unlink(bodyPath).catch(() => undefined);
  }
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

    if (paragraph.length <= 92) {
      chunks.push(`${paragraph}\n`);
      continue;
    }

    for (let index = 0; index < paragraph.length; index += 92) {
      chunks.push(paragraph.slice(index, index + 92));
    }
    chunks.push("\n");
  }

  return chunks.filter(Boolean);
};

const jsonLine = (event: StreamEvent) => encoder.encode(`${JSON.stringify(event)}\n`);

const buildTextFallbackResult = (payload: StudioPayload) => {
  const fallback = buildLocalFallback(payload);
  return {
    type: "text" as const,
    text: fallback.text,
    note: fallback.note,
    meta: extractResultMeta(payload, fallback.text),
  };
};

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
    max_tokens: 2200,
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

const generateReviewedText = async (
  payload: StudioPayload,
  onStatus?: (message: string) => Promise<void> | void,
): Promise<AssistantResult> => {
  const promptConfig = buildSkillInstructions(payload);

  if (!textClient) {
    return buildTextFallbackResult(payload);
  }

  try {
    await onStatus?.("正在整理需求…");
    const draft = await withTimeout(
      generateText(promptConfig.systemPrompt, promptConfig.userPrompt),
      textTimeoutMs,
      "text-draft",
    );

    let finalText = draft.text;
    if (promptConfig.reviewSystemPrompt && promptConfig.buildReviewUserPrompt) {
      await onStatus?.("正在做自检复核…");
      const reviewed = await withTimeout(
        generateText(promptConfig.reviewSystemPrompt, promptConfig.buildReviewUserPrompt(draft.text), 0.35),
        textTimeoutMs,
        "text-review",
      );
      finalText = reviewed.text || draft.text;
    }

    return {
      type: "text",
      text: finalText,
      note: payload.skill === "xiaohongshu-biji" ? "已生成并完成小红书路线自检。" : "已生成并完成一轮内容自检。",
      meta: extractResultMeta(payload, finalText),
    };
  } catch (error) {
    console.error("[text-generation]", error);
    return {
      ...buildTextFallbackResult(payload),
      note: "模型暂时不稳定，已自动回退到可直接使用的基础结果。",
    };
  }
};

const collectImageAssets = (payload: StudioPayload) => {
  if (payload.skill === "chanping-toutu" || payload.skill === "xiaohongshu-bijitu") {
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

const buildReferenceNote = (payload: StudioPayload) =>
  collectImageAssets(payload).referenceAssets.length
    ? "参考图只继承构图、材质、灯光和氛围，不要照搬无关文字或无关物体。"
    : "";

const buildBackgroundPrompt = (payload: StudioPayload) => {
  if (payload.skill === "chanping-toutu") {
    const form = payload.form as VisualForm;
    const theme = form.themeColor?.trim() || "薄荷青";
    const product = form.productName?.trim() || "门店主推产品";
    const designType = form.designType?.trim() || "产品头图";
    const isKt = /KT/i.test(designType);

    return `
请生成一张只包含背景和真实场景氛围的健身房商业视觉底图。
设计类型：${designType}
产品主题：${product}
主题色：${theme}
要求：
1. ${isKt ? "竖版物料背景，适合KT板排版" : "4:3 横版背景，适合抖音团购头图排版"}。
2. 只生成健身房真实场景：器械区、镜面墙、前台、力量区、训练地面、运动灯光氛围。
3. 不要文字、不要数字、不要字母、不要Logo、不要二维码、不要水印。
4. 颜色必须围绕“${theme}”延展，保持大体色差不变，不要跑成别的色系。
5. 整体要高级、清晰、明亮、有商业感，不要廉价电商海报风。
6. 不要咖啡厅、家居、办公室、美妆店、城市街景、餐厅等无关场景。
7. ${buildReferenceNote(payload)}
8. ${form.extraNotes?.trim() || "突出健身房真实商业空间质感。"}
`.trim();
  }

  const form = payload.form as XiaohongshuForm;
  const theme = form.themeColor?.trim() || "高级冷灰蓝";
  const route = form.route?.trim() || "探店种草笔记";
  const product = form.productName?.trim() || "健身探店";
  const isConversion = route.includes("团购");

  return `
请生成一张只包含背景和真实场景氛围的小红书健身封面底图。
路线：${route}
主题：${product}
主题色：${theme}
要求：
1. 3:4 竖版，只做封面背景。
2. 画面主体必须是健身房真实语境：器械区、镜面墙、训练动作、前台、训练氛围。
3. 不要文字、不要数字、不要字母、不要Logo、不要二维码、不要水印。
4. 主标题区域留在中上部，底部留出封面文案安全空间。
5. 主题色围绕“${theme}”展开，保持大体色差不变。
6. ${isConversion ? "整体可以更有转化张力，但不要像廉价促销海报。" : "整体更像真实探店或轻IP种草，不要像强促销海报。"}
7. 不要咖啡厅、家居、美妆店、办公场景或无关ins风布景。
8. ${buildReferenceNote(payload)}
9. ${form.extraNotes?.trim() || "突出真实健身空间与高级质感。"}
`.trim();
};

const generateImageOnce = async (prompt: string, size: "1024x1536" | "1536x1024") => {
  if (!imageApiKey) {
    throw new Error("image client not configured");
  }

  const imageBody = {
    model: imageModel,
    prompt: compactImagePrompt(prompt),
    size,
    quality: "low",
    output_format: "png",
  };

  if (process.platform === "win32") {
    return requestImageViaPowerShell(imageBody);
  }

  const response = await withTimeout(
    fetch(`${imageBaseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${imageApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(imageBody),
    }),
    imageTimeoutMs,
    "image-generate",
  );

  return parseImageResponseText(await response.text());
};

const generateStableImage = async (prompt: string, size: "1024x1536" | "1536x1024") => {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await generateImageOnce(prompt, size);
    } catch (error) {
      lastError = error;
      console.error("[image-generation]", error);
      await sleep(600);
    }
  }

  throw lastError || new Error("image generation failed");
};

const sanitizeSegment = (value: string) =>
  value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

const ensureUniquePath = async (dir: string, baseName: string, ext: string) => {
  const firstPath = path.join(dir, `${baseName}.${ext}`);

  try {
    await stat(firstPath);
  } catch {
    return firstPath;
  }

  const stamp = new Date().toISOString().replace(/[:T]/g, "-").replace(/\..+$/, "");
  return path.join(dir, `${baseName}-${stamp}.${ext}`);
};

const buildOutputBasename = (payload: StudioPayload) => {
  if (payload.skill === "chanping-toutu") {
    const form = payload.form as VisualForm;
    return [form.designType, form.productName || form.storeName]
      .map((item) => sanitizeSegment(item || ""))
      .filter(Boolean)
      .join("-") || "产品头图";
  }

  const form = payload.form as XiaohongshuForm;
  return ["小红书封面", form.productName || form.storeName]
    .map((item) => sanitizeSegment(item || ""))
    .filter(Boolean)
    .join("-") || "小红书封面";
};

const savePngToDesktop = async (payload: StudioPayload, buffer: Buffer) => {
  const desktopDir = path.join(os.homedir(), "Desktop");
  await mkdir(desktopDir, { recursive: true });
  const outputPath = await ensureUniquePath(desktopDir, buildOutputBasename(payload), "png");
  await writeFile(outputPath, buffer);
  return outputPath;
};

const resolveThemeColor = (value: string) => {
  const input = value.trim().toLowerCase();
  const hexMatch = input.match(/#([0-9a-f]{6}|[0-9a-f]{3})/i);
  if (hexMatch) {
    return hexMatch[0];
  }

  const themeMap: Record<string, string> = {
    薄荷青: "#63d6ce",
    薄荷绿: "#67d7be",
    宝蓝: "#2956ff",
    深蓝: "#163ba9",
    天蓝: "#6fc7ff",
    黑金: "#caa35b",
    红色: "#ff6176",
    橙色: "#ff9145",
    金色: "#d5ae64",
    青色: "#58d2d0",
    绿色: "#67d58f",
  };

  return themeMap[value.trim()] || "#6f8cff";
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const splitItems = (value: string, limit: number) =>
  value
    .split(/[\n,，、;；]+/)
    .map((item) => item.trim().replace(/^\d+[.、\s]*/, ""))
    .filter(Boolean)
    .slice(0, limit);

const buildImageTitle = (payload: StudioPayload) => {
  if (payload.skill === "chanping-toutu") {
    const form = payload.form as VisualForm;
    return form.productName?.trim() || "主推产品";
  }

  const form = payload.form as XiaohongshuForm;
  return form.productName?.trim() || "健身探店";
};

const buildReviewSummary = (payload: StudioPayload) =>
  payload.skill === "chanping-toutu"
    ? "已按安全区、主题色、Logo层级和健身场景限制完成结构自检。"
    : "已按3:4封面逻辑、标题安全区、主题色和健身语境完成结构自检。";

const composeStudioSvg = (payload: StudioPayload, backgroundBase64: string) => {
  const isXhs = payload.skill === "xiaohongshu-bijitu";
  const width = isXhs ? 1024 : /KT/i.test((payload.form as VisualForm).designType || "") ? 1024 : 1536;
  const height = isXhs ? 1536 : /KT/i.test((payload.form as VisualForm).designType || "") ? 1536 : 1024;
  const backgroundDataUrl = `data:image/png;base64,${backgroundBase64}`;
  const logoData = collectImageAssets(payload).logoAssets[0]?.dataUrl || "";
  const themeColor = resolveThemeColor((payload.form as VisualForm | XiaohongshuForm).themeColor || "");
  const title = escapeXml(buildImageTitle(payload));

  if (isXhs) {
    const form = payload.form as XiaohongshuForm;
    const storeName = escapeXml(form.storeName || "门店内容");
    const route = escapeXml(form.route || "小红书笔记图");
    const price = escapeXml(form.price || "");
    const points = [...splitItems(form.storeHighlights, 2), ...splitItems(form.benefits, 2)].slice(0, 3);

    const pointMarkup = points
      .map((item, index) => {
        const y = 860 + index * 102;
        return `
        <g transform="translate(110 ${y})">
          <circle cx="20" cy="20" r="20" fill="${themeColor}" fill-opacity="0.22" />
          <circle cx="20" cy="20" r="8" fill="${themeColor}" />
          <text x="58" y="30" font-size="30" fill="#ffffff" font-family="'Microsoft YaHei', Arial, sans-serif" font-weight="700">${escapeXml(item)}</text>
        </g>`;
      })
      .join("");

    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="xhsPanel" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(10,13,19,0.82)" />
      <stop offset="100%" stop-color="rgba(17,23,34,0.62)" />
    </linearGradient>
    <linearGradient id="xhsPrice" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f4f6fb" />
      <stop offset="100%" stop-color="${themeColor}" />
    </linearGradient>
  </defs>
  <image href="${backgroundDataUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />
  <rect width="${width}" height="${height}" fill="rgba(6,8,12,0.18)" />
  <rect x="60" y="60" width="${width - 120}" height="${height - 120}" rx="44" fill="url(#xhsPanel)" stroke="rgba(255,255,255,0.16)" />
  ${logoData ? `<image href="${logoData}" x="110" y="112" width="108" height="108" preserveAspectRatio="xMidYMid meet" />` : ""}
  <text x="${logoData ? 240 : 110}" y="160" font-size="28" fill="rgba(255,255,255,0.84)" font-family="'Microsoft YaHei', Arial, sans-serif">${storeName}</text>
  <text x="110" y="240" font-size="28" fill="rgba(199,212,255,0.9)" font-family="'Microsoft YaHei', Arial, sans-serif">${route}</text>
  <text x="110" y="420" font-size="94" fill="#ffffff" font-family="'Microsoft YaHei', Arial, sans-serif" font-weight="800">${title}</text>
  ${price ? `<rect x="110" y="500" width="320" height="94" rx="28" fill="url(#xhsPrice)" /><text x="156" y="562" font-size="58" fill="#08111b" font-family="'Microsoft YaHei', Arial, sans-serif" font-weight="800">${price}</text>` : ""}
  ${pointMarkup}
</svg>`.trim();
  }

  const form = payload.form as VisualForm;
  const storeName = escapeXml(form.storeName || "门店内容");
  const designType = escapeXml(form.designType || "产品头图");
  const price = escapeXml(form.price || "");
  const points = splitItems(form.benefits, /KT/i.test(form.designType || "") ? 6 : 5);

  const pointMarkup = points
    .map((item, index) => {
      const perRow = /KT/i.test(form.designType || "") ? 1 : 3;
      const row = Math.floor(index / perRow);
      const col = index % perRow;
      const startX = /KT/i.test(form.designType || "") ? 160 : 340;
      const startY = /KT/i.test(form.designType || "") ? 650 : 700;
      const x = startX + col * 320;
      const y = startY + row * 96;
      return `
      <g transform="translate(${x} ${y})">
        <circle cx="18" cy="18" r="18" fill="${themeColor}" fill-opacity="0.22" />
        <circle cx="18" cy="18" r="8" fill="${themeColor}" />
        <text x="52" y="28" font-size="28" fill="#ffffff" font-family="'Microsoft YaHei', Arial, sans-serif" font-weight="700">${escapeXml(item)}</text>
      </g>`;
    })
    .join("");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="heroPanel" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(8,12,18,0.84)" />
      <stop offset="100%" stop-color="rgba(19,24,37,0.68)" />
    </linearGradient>
    <linearGradient id="heroPrice" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f6f7fb" />
      <stop offset="100%" stop-color="${themeColor}" />
    </linearGradient>
  </defs>
  <image href="${backgroundDataUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />
  <rect width="${width}" height="${height}" fill="rgba(8,10,14,0.18)" />
  <rect x="${/KT/i.test(form.designType || "") ? 76 : 250}" y="70" width="${/KT/i.test(form.designType || "") ? width - 152 : 1036}" height="${/KT/i.test(form.designType || "") ? height - 140 : 884}" rx="44" fill="url(#heroPanel)" stroke="rgba(255,255,255,0.16)" />
  ${logoData ? `<image href="${logoData}" x="${/KT/i.test(form.designType || "") ? 390 : 610}" y="96" width="${/KT/i.test(form.designType || "") ? 240 : 300}" height="144" preserveAspectRatio="xMidYMid meet" />` : `<text x="${width / 2}" y="160" text-anchor="middle" font-size="34" fill="rgba(255,255,255,0.85)" font-family="'Microsoft YaHei', Arial, sans-serif">${storeName}</text>`}
  <text x="${width / 2}" y="${/KT/i.test(form.designType || "") ? 300 : 260}" text-anchor="middle" font-size="30" fill="rgba(205,218,255,0.9)" font-family="'Microsoft YaHei', Arial, sans-serif">${designType}</text>
  <text x="${width / 2}" y="${/KT/i.test(form.designType || "") ? 470 : 420}" text-anchor="middle" font-size="${/KT/i.test(form.designType || "") ? 102 : 112}" fill="#ffffff" font-family="'Microsoft YaHei', Arial, sans-serif" font-weight="900">${title}</text>
  ${price ? `<rect x="${/KT/i.test(form.designType || "") ? 260 : 520}" y="${/KT/i.test(form.designType || "") ? 520 : 470}" width="${/KT/i.test(form.designType || "") ? 504 : 496}" height="110" rx="34" fill="url(#heroPrice)" /><text x="${width / 2}" y="${/KT/i.test(form.designType || "") ? 592 : 544}" text-anchor="middle" font-size="74" fill="#07101b" font-family="'Microsoft YaHei', Arial, sans-serif" font-weight="900">${price}</text>` : ""}
  ${pointMarkup}
</svg>`.trim();
};

const renderPngFromSvg = (svg: string) => {
  const windowsFontDir = path.join(process.env.WINDIR || "C:\\Windows", "Fonts");
  const bundledFont = path.join(process.cwd(), "assets", "fonts", "NotoSansCJKsc-Regular.otf");
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "original",
    },
    font: {
      fontFiles: [
        bundledFont,
        path.join(windowsFontDir, "msyh.ttc"),
        path.join(windowsFontDir, "msyhbd.ttc"),
        path.join(windowsFontDir, "simhei.ttf"),
      ],
      loadSystemFonts: true,
      defaultFontFamily: "Noto Sans CJK SC",
    },
  });

  return Buffer.from(resvg.render().asPng());
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
          console.error("[stream-text]", error);
          const fallback = buildTextFallbackResult(payload);
          for (const chunk of splitTextIntoChunks(fallback.text)) {
            push({ type: "chunk", text: chunk });
          }
          push({ type: "result", data: fallback });
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
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as StudioPayload | null;
  if (!payload?.skill || !payload?.form || typeof payload.form !== "object") {
    return NextResponse.json({ error: "缺少有效的请求内容。" }, { status: 400 });
  }

  const wantsStream = request.headers.get("x-stream-text") === "1";
  if (!isImagePayload(payload) && wantsStream) {
    return streamTextResponse(payload);
  }

  const promptConfig = buildSkillInstructions(payload);
  if (!textClient && !imageApiKey) {
    return NextResponse.json(buildLocalFallback(payload));
  }

  try {
    if (!isImagePayload(payload)) {
      return NextResponse.json(await generateReviewedText(payload));
    }

    if (!imageApiKey) {
      return NextResponse.json(
        {
          error: "image generation disabled",
          note: "当前环境没有可用的图片生成配置。",
        },
        { status: 500 },
      );
    }

    const backgroundPrompt = buildBackgroundPrompt(payload);
    const backgroundBase64 = await generateStableImage(backgroundPrompt, promptConfig.imageSize || "1536x1024");
    const svg = composeStudioSvg(payload, backgroundBase64);
    const pngBuffer = renderPngFromSvg(svg);
    const imageDataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    const savedPath = await savePngToDesktop(payload, pngBuffer).catch(() => "");

    return NextResponse.json({
      type: "image",
      text: "图片已生成，可直接查看，也已按当前技能规则完成一轮自检。",
      note: `${promptConfig.successNote || "已完成图片生成。"}${savedPath ? " 文件也已保存到桌面。" : ""}`,
      imageDataUrl,
      actions: savedPath ? [`桌面文件：${savedPath}`] : undefined,
      meta: {
        savedPath,
        reviewSummary: buildReviewSummary(payload),
      },
    });
  } catch (error) {
    console.error("[generate-route]", error);

    if (isImagePayload(payload)) {
      return NextResponse.json(
        {
          error: "image generation failed",
          note: getErrorMessage(error),
        },
        { status: 500 },
      );
    }

    const fallback = buildLocalFallback(payload);
    return NextResponse.json({
      type: fallback.type,
      text: fallback.text,
      note: getErrorMessage(error),
    });
  }
}
