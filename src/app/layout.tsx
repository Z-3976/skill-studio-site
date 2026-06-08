import type { Metadata } from "next";
import { Barlow_Condensed, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const titleFont = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-title",
});

const bodyFont = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Skill Studio",
  description: "把产品头图、短视频模板和直播话术封装成一个可发布的网站工作台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${titleFont.variable} ${bodyFont.variable}`}>{children}</body>
    </html>
  );
}
