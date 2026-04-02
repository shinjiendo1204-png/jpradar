import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "JPRADAR — Japan Social Intelligence for Global Marketers",
  description: "Monitor Japanese Twitter, Note, and online communities in English. Daily AI-powered intelligence reports on your market.",
  openGraph: {
    title: "JPRADAR — Japan Social Intelligence",
    description: "See what Japanese buyers are saying about your market — in English, daily.",
    url: "https://jpradar.io",
    siteName: "JPRADAR",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
