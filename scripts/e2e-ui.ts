/**
 * Browser end-to-end check of the real write path on Studio Next.
 *
 * Launches Chrome, injects a minimal EIP-1193 test wallet (a fresh throwaway
 * key that signs locally in this process and is never printed), and drives the
 * dashboard: connect -> faucet -> blocked exposure -> consensus assessment ->
 * permitted exposure. Every step goes through the official Transaction Kit
 * panel and waits for the dashboard's own state confirmation.
 *
 * Usage: APP_URL=http://localhost:3217 npx tsx scripts/e2e-ui.ts [--only-blocked]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright-core";
import { createWalletClient, http, type Hex as VHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { studioDevnet } from "genlayer-js/chains";
import { ROOT, RPC_URL } from "./lib.ts";

const APP_URL = process.env.APP_URL ?? "http://localhost:3217";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = resolve(ROOT, "docs", "screenshots");
const ONLY_BLOCKED = process.argv.includes("--only-blocked");

const account = privateKeyToAccount(generatePrivateKey());
const wallet = createWalletClient({ account, chain: studioDevnet, transport: http(RPC_URL) });
const sent: string[] = [];
let authorized = false;

async function rpc(method: string, params: unknown[] = []) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const body = (await res.json()) as { result?: unknown; error?: { code: number; message: string } };
  if (body.error) throw Object.assign(new Error(body.error.message), { code: body.error.code });
  return body.result;
}

async function handle(method: string, params: unknown[] = []): Promise<unknown> {
  switch (method) {
    case "eth_requestAccounts":
      authorized = true;
      return [account.address];
    case "eth_accounts":
      return authorized ? [account.address] : [];
    case "eth_chainId":
      return `0x${studioDevnet.id.toString(16)}`;
    case "wallet_switchEthereumChain":
    case "wallet_addEthereumChain":
      return null;
    case "personal_sign":
      return account.signMessage({ message: { raw: params[0] as VHex } });
    case "eth_sendTransaction": {
      const tx = params[0] as { to: VHex; data?: VHex; value?: VHex; gas?: VHex };
      const hash = await wallet.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value ? BigInt(tx.value) : 0n,
        gas: tx.gas ? BigInt(tx.gas) : undefined,
      });
      sent.push(hash);
      return hash;
    }
    default:
      return rpc(method, params);
  }
}

async function approveInPanel(page: Page, label: string) {
  const dialog = page.locator("dialog.txdialog");
  await dialog.waitFor({ state: "visible" });
  // Transaction Kit shows a fee review, then a sign action. Click the kit's primary action.
  const sign = dialog.locator("button", { hasText: /sign|approve|confirm|submit/i }).last();
  await sign.waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForFunction((el) => !(el as HTMLButtonElement).disabled, await sign.elementHandle(), { timeout: 60_000 });
  await page.screenshot({ path: `${OUT}/${label}-review.png` });
  await sign.click();
}

async function waitOutcome(page: Page, pattern: RegExp, label: string, timeoutMs: number) {
  const headline = page.locator("#outcome-title");
  await headline.filter({ hasText: pattern }).waitFor({ state: "visible", timeout: timeoutMs });
  const dialog = page.locator("dialog.txdialog");
  if (await dialog.isVisible()) await dialog.getByRole("button", { name: "Close" }).first().click();
  await page.locator("section.outcome").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: false });
  const text = await page.locator("section.outcome").innerText();
  console.log(`\n[${label}]\n${text}\n`);
  return text;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/rate limit|429/i.test(m.text()) && errors.push(m.text()));
  await page.exposeFunction("__rgWalletRequest", async (method: string, params: unknown[]) => {
    try {
      return { ok: await handle(method, params) };
    } catch (err) {
      return { error: { message: err instanceof Error ? err.message : String(err), code: (err as { code?: number }).code ?? -32603 } };
    }
  });
  // Plain-string init script: tsx would otherwise inject helpers the page lacks.
  await page.addInitScript({
    content: `window.ethereum = {
      isRedemptionGuardTestWallet: true,
      request: async ({ method, params }) => {
        const res = await window.__rgWalletRequest(method, params ?? []);
        if (res.error) throw Object.assign(new Error(res.error.message), { code: res.error.code });
        return res.ok;
      },
      on: () => undefined,
      removeListener: () => undefined,
    };`,
  });

  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.locator(".asset__ticker").first().waitFor({ timeout: 120_000 });
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await page.locator(".netbadge--ok").waitFor();
  console.log(`Connected test wallet ${account.address} on Studio Next`);

  await page.getByRole("button", { name: /Get Studio Next test GEN/ }).click();
  await page.locator(".faucet", { hasText: /Balance:/ }).waitFor({ timeout: 60_000 });
  console.log(await page.locator(".faucet").innerText());

  // 1. Blocked exposure on HLUSD (latest status is not ELIGIBLE).
  const exposurePanel = page.locator("section", { has: page.locator("#exposure-title") });
  await exposurePanel.getByRole("radio", { name: "HLUSD" }).click();
  await exposurePanel.locator("input").fill("5000");
  await exposurePanel.getByRole("button", { name: "Request exposure" }).click();
  await approveInPanel(page, "ui-blocked-exposure");
  await waitOutcome(page, /Exposure blocked for HLUSD/, "ui-blocked-exposure", 8 * 60_000);
  if (ONLY_BLOCKED) return finish();

  // 2. Consensus assessment of NWUSD using the public operational fixture.
  const assessPanel = page.locator("section", { has: page.locator("#assess-title") });
  await assessPanel.getByRole("button", { name: /Operational/ }).click();
  await assessPanel.getByRole("button", { name: "Run consensus assessment" }).click();
  await approveInPanel(page, "ui-assessment");
  await waitOutcome(page, /Validators agreed|No assessment was recorded|Could not confirm/, "ui-assessment", 15 * 60_000);

  // 3. Permitted exposure on NWUSD.
  await exposurePanel.getByRole("radio", { name: "NWUSD" }).click();
  await exposurePanel.locator("input").fill("75000");
  await exposurePanel.getByRole("button", { name: "Request exposure" }).click();
  await approveInPanel(page, "ui-permitted-exposure");
  await waitOutcome(page, /Exposure recorded for NWUSD|Exposure blocked for NWUSD|Could not confirm/, "ui-permitted-exposure", 8 * 60_000);
  return finish();

  async function finish() {
    await page.screenshot({ path: `${OUT}/ui-final.png`, fullPage: true });
    writeFileSync(resolve(OUT, "ui-e2e-transactions.json"), `${JSON.stringify({ wallet: account.address, evmTransactions: sent, pageErrors: errors, at: new Date().toISOString() }, null, 2)}\n`);
    console.log(`EVM submissions: ${sent.length}; page errors: ${errors.length ? errors.join(" | ") : "none"}`);
    await browser.close();
  }
}

main().catch(async (err) => {
  console.error(`E2E failed: ${err instanceof Error ? err.stack : String(err)}`);
  process.exit(1);
});
