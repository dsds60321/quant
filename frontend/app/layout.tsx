import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "퀀트 파일럿",
  description: "기관형 정량투자 분석 플랫폼 UI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="bg-[var(--bg)] text-[var(--fg)] antialiased">{children}</body>
    </html>
  );
}
