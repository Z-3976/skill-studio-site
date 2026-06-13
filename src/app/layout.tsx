import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_SC, Space_Grotesk } from "next/font/google";
import "./globals.css";

const titleFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-title",
});

const bodyFont = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "门店内容工作台",
  description: "统一生成产品头图、短视频脚本、直播话术和小红书笔记内容。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${titleFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>{children}</body>
    </html>
  );
}
