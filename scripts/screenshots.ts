/** Responsive check: full-page desktop (1440) and mobile (390) screenshots plus horizontal-overflow and console-error checks. */
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import { ROOT } from "./lib.ts";

const url = process.argv[2] ?? process.env.APP_URL ?? "http://localhost:3217";
const out = resolve(ROOT, "docs", "screenshots");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
let failed = false;
for (const [name, vp, mobile] of [
  ["desktop", { width: 1440, height: 900 }, false],
  ["mobile", { width: 390, height: 844 }, true],
] as const) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
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
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${vp.width}px: scrollWidth=${scrollW} errors=${errors.length ? errors.join(" | ") : "none"}`);
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
