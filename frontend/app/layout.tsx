import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Pixelify_Sans } from "next/font/google";
import "@genlayer/transaction-kit-react/styles.css";
import "./globals.css";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });
// Display only: logo, tickers, step numbers, tiny labels. Never body copy, buttons, or data.
const pixel = Pixelify_Sans({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-pixel" });

export const metadata: Metadata = {
  title: "Redemption Guard",
  description:
    "GenLayer validators judge stablecoin redemption evidence against a frozen treasury policy; only an agreed ELIGIBLE status opens the exposure gate. Studio Next prototype.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf3e2" },
    { media: "(prefers-color-scheme: dark)", color: "#131a35" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${pixel.variable}`}>
      <body>{children}</body>
    </html>
  );
}
