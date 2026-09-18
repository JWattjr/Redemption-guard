"use client";

import { STUDIO_NEXT } from "./config";

/**
 * Studio Next allows 30 JSON-RPC requests per minute per client. The
 * dashboard reader and the Transaction Kit tracker (2 s polling) both call it
 * with fetch, so space those requests and retry rate-limited ones. A
 * rate-limited request is rejected before processing, so a retry is safe.
 */
const MIN_SPACING_MS = 2_100;
const MAX_ATTEMPTS = 6;
let installed = false;
let gate: Promise<void> = Promise.resolve();

function nextSlot(): Promise<void> {
  const mine = gate;
  gate = mine.then(() => new Promise((r) => setTimeout(r, MIN_SPACING_MS)));
  return mine;
}

async function isRateLimited(res: Response): Promise<boolean> {
  if (res.status === 429) return true;
  try {
    const body = (await res.clone().json()) as { error?: { message?: string } };
    return /rate limit/i.test(body?.error?.message ?? "");
  } catch {
    return false;
  }
}

export function installRpcThrottle(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(STUDIO_NEXT.rpcUrl)) return original(input, init);
    for (let attempt = 1; ; attempt++) {
      await nextSlot();
      const res = await original(input, init);
      if (attempt >= MAX_ATTEMPTS || !(await isRateLimited(res))) return res;
      await new Promise((r) => setTimeout(r, 5_000 * attempt));
    }
  };
}
