import type { Metadata } from "next";
import { Source_Serif_4, Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin", "vietnamese"],
  display: "swap",
  style: ["normal", "italic"],
});

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin", "vietnamese"],
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Bàn viết",
  description: "Tổng hợp nghiên cứu và soạn bài đăng Facebook",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${sourceSerif.variable} ${beVietnam.variable} ${jetbrains.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <SiteNav />
        <main className="flex-1">{children}</main>
        <footer className="rule mt-24 border-t">
          <div className="mx-auto max-w-5xl px-6 py-8">
            <p className="text-xs text-ink/45">
              Nguồn nghiên cứu: PubMed · OpenAlex. Số liệu luôn cần chị đọc lại
              bản gốc trước khi đăng.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
