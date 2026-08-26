import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '中科曙光｜2026 届应届生集训宣传平台',
  description: '免登录上传集训照片或视频，系统自动生成上传码，并通过十六个连队相册轮播展示风采。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
