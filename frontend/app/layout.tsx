import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, Spline_Sans_Mono } from "next/font/google";
import "@genlayer/transaction-kit-react/styles.css";
import "./globals.css";

const sans = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" });
const mono = Spline_Sans_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });
// Signage caps: strip labels, column headers, and the board's own display
// glyphs (tickers, gate cells, step numerals) in its heavy weight.
const strip = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-strip" });

export const metadata: Metadata = {
  title: "Redemption Guard",
  description:
    "GenLayer validators judge stablecoin redemption evidence against a frozen treasury policy; only an agreed ELIGIBLE status opens the exposure gate. Studio Next prototype.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e1622",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${strip.variable}`}>
      <body>{children}</body>
    </html>
  );
}
