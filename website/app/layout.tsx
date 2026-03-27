import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InspiraDB - AI-Powered Local Image Management for Mac",
  description: "Organize 50,000+ images with AI auto-tagging and semantic search. 100% offline, privacy-first. Cloud BigBrain learns, Local SmallBrain responds in milliseconds.",
  keywords: ["AI image tagging", "semantic search", "offline photo organizer", "mac image management", "privacy first", "local AI"],
  authors: [{ name: "InspiraDB" }],
  creator: "InspiraDB",
  metadataBase: new URL("https://www.inspiradb.com"),
  alternates: {
    languages: {
      "en": "/",
      "zh": "/zh/",
    },
  },
  openGraph: {
    title: "InspiraDB - AI-Powered Local Image Management",
    description: "Organize 50,000+ images with AI. 100% offline, privacy-first.",
    url: "https://www.inspiradb.com",
    siteName: "InspiraDB",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "InspiraDB - AI-Powered Local Image Management",
    description: "Organize 50,000+ images with AI. 100% offline, privacy-first.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
