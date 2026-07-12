import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "고메 Wisely 장바구니",
  description: "필요한 와이즐리 상품을 함께 기록하는 공동 장바구니",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
