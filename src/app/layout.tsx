import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: 'mela gym - 予約システム',
    template: '%s | mela gym',
  },
  description: 'メラジム パーソナルトレーニング予約。完全個室のパーソナルトレーニングジム。無料体験セッション受付中。',
  icons: {
    icon: '/images/favicon.png',
    apple: '/images/favicon.png',
  },
  openGraph: {
    title: 'mela gym - パーソナルトレーニング予約',
    description: '完全個室のパーソナルトレーニングジム。無料体験セッション受付中。',
    images: [{ url: '/images/ogp.png', width: 1200, height: 630 }],
    type: 'website',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'mela gym - パーソナルトレーニング予約',
    description: '完全個室のパーソナルトレーニングジム。無料体験セッション受付中。',
    images: ['/images/ogp.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${barlowCondensed.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
