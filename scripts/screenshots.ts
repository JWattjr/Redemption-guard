/** Responsive check: full-page screenshots at desktop (1440), tablet (768) and mobile (390), light and dark, plus horizontal-overflow and console-error checks. */
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import { ROOT } from "./lib.ts";

const url = process.argv[2] ?? process.env.APP_URL ?? "http://localhost:3217";
const out = resolve(ROOT, "docs", "screenshots");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const runs = [
  ["desktop", 1440, 900, "light"],
  ["tablet", 768, 1024, "light"],
  ["mobile", 390, 844, "light"],
  ["desktop-dark", 1440, 900, "dark"],
  ["mobile-dark", 390, 844, "dark"],
] as const;
let failed = false;
for (const [name, width, height, scheme] of runs) {
  const mobile = width < 700;
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/rate limit|429/i.test(m.text()) && errors.push(m.text()));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator(".asset__ticker").first().waitFor({ timeout: 120_000 });
  const { scrollW, innerW } = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth }));
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  const ok = scrollW <= innerW && errors.length === 0;
  failed ||= !ok;
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${width}px ${scheme}: scrollWidth=${scrollW} errors=${errors.length ? errors.join(" | ") : "none"}`);
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
