import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const font = Be_Vietnam_Pro({ subsets: ["vietnamese", "latin"], weight: ["400", "500", "700", "800"], variable: "--font-be-vietnam" });

export const metadata: Metadata = {
  title: { default: "SeatRush", template: "%s · SeatRush" },
  description: "Demo bán vé concert chịu tải mở bán: phòng chờ ảo, giữ ghế có hạn, không bán trùng ghế.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={font.variable}>
      <body className="font-sans antialiased">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-lg font-extrabold tracking-tight">
            Seat<span className="text-accent">Rush</span>
          </Link>
          <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">Bản demo · sự kiện giả</span>
        </header>
        <main className="mx-auto max-w-5xl px-5 pb-20">{children}</main>
      </body>
    </html>
  );
}
