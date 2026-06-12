# Agent Skill Studio

把 `chanping-toutu`、`duanshipin-moban`、`zhibo-huashu` 三个 Codex Skill 封装成一个可部署到 Vercel 的深色工作台。

## 本地启动

```bash
npm install
copy .env.example .env.local
npm run dev
```

## 环境变量

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_TEXT_MODEL`
- `OPENAI_API_KEY`
- `ENABLE_IMAGE_GENERATION`

当前默认策略：

- 文本生成优先且默认只走 DeepSeek
- 图片生成固定走 OpenAI `gpt-image-2`
- OpenAI 仅用于生图，不参与文案生成

## 功能

- 产品头图 / KT 板生成工作台
- 短视频脚本工作台
- 直播话术工作台
- 产品头图遵循“能生图就生图，不能生图就给最终提示词”的规则
- 未配置模型 Key 时，会自动降级为本地模板输出，不会直接报错

## 本地注意事项

- 如果 Windows 用户目录包含中文字符，`Next.js` 在本地开发态偶发会出现 `.next` 路径编码问题
- 遇到这类问题时，建议把项目临时复制到纯英文路径再运行，例如 `C:\temp\skill-studio-check`

## 部署

1. 推送到 GitHub
2. 在 Vercel 导入仓库
3. 按 `.env.example` 配置环境变量
4. 重新部署
