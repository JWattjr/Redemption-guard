"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createTransactionKit, type TransactionKit } from "@genlayer/transaction-kit";
import { studioDevnet } from "genlayer-js/chains";
import { STUDIO_NEXT } from "./config";
import feeProfile from "../fee-profile.json";

type Eip1193 = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
};

declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

export type WalletState = {
  available: boolean;
  address?: `0x${string}`;
  chainId?: number;
  onStudioNext: boolean;
  connecting: boolean;
  error?: string;
  kit?: TransactionKit;
  connect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  requestTestFunds: () => Promise<string>;
};

const ADD_CHAIN_PARAMS = {
  chainId: STUDIO_NEXT.chainIdHex,
  chainName: "GenLayer Studio Next",
  rpcUrls: [STUDIO_NEXT.rpcUrl],
  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
  blockExplorerUrls: [STUDIO_NEXT.explorerUrl],
};

function message(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return String(err);
}

export function useWallet(): WalletState {
  // Detect the injected wallet only after mount so the first client render
  // matches the prerendered HTML exactly (no hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const available = mounted && typeof window !== "undefined" && Boolean(window.ethereum);
  const [address, setAddress] = useState<`0x${string}`>();
  const [chainId, setChainId] = useState<number>();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const eth = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!eth) return;
    const onAccounts = (accounts: unknown) => {
      const list = accounts as string[];
      setAddress(list?.[0] ? (list[0] as `0x${string}`) : undefined);
    };
    const onChain = (id: unknown) => setChainId(parseInt(String(id), 16));
    eth.request({ method: "eth_accounts" }).then(onAccounts).catch(() => undefined);
    eth.request({ method: "eth_chainId" }).then(onChain).catch(() => undefined);
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const switchNetwork = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) return;
    setError(undefined);
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: STUDIO_NEXT.chainIdHex }] });
    } catch (err) {
      const code = (err as { code?: number })?.code;
      if (code === 4902 || /unrecognized|not been added|unknown chain/i.test(message(err))) {
        try {
          await eth.request({ method: "wallet_addEthereumChain", params: [ADD_CHAIN_PARAMS] });
        } catch (addErr) {
          setError(message(addErr));
        }
      } else {
        setError(message(err));
      }
    }
    const id = await eth.request({ method: "eth_chainId" }).catch(() => undefined);
    if (id) setChainId(parseInt(String(id), 16));
  }, []);

  const connect = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) {
      setError("No injected wallet found. Install MetaMask or another EIP-1193 wallet.");
      return;
    }
    setConnecting(true);
    setError(undefined);
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      setAddress(accounts[0] as `0x${string}`);
      const id = parseInt(String(await eth.request({ method: "eth_chainId" })), 16);
      setChainId(id);
      if (id !== STUDIO_NEXT.chainId) await switchNetwork();
    } catch (err) {
      setError(message(err));
    } finally {
      setConnecting(false);
    }
  }, [switchNetwork]);

  /** Studio Next test faucet (sim_fundAccount). Test GEN only; no real value. */
  const requestTestFunds = useCallback(async () => {
    if (!address) throw new Error("Connect a wallet first");
    const call = async (method: string, params: unknown[]) => {
      const res = await fetch(STUDIO_NEXT.rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
      });
      const body = (await res.json()) as { result?: unknown; error?: { message: string } };
      if (body.error) throw new Error(body.error.message);
      return body.result;
    };
    await call("sim_fundAccount", [address, 10 * 1e18]);
    const balance = BigInt(String(await call("eth_getBalance", [address, "latest"])));
    return `${(Number(balance / 10n ** 14n) / 1e4).toFixed(4)} GEN`;
  }, [address]);

  const onStudioNext = chainId === STUDIO_NEXT.chainId;

  const kit = useMemo(() => {
    if (!address || !onStudioNext || typeof window === "undefined" || !window.ethereum) return undefined;
    return createTransactionKit({ chain: studioDevnet, provider: window.ethereum, account: address, suggestions: feeProfile });
  }, [address, onStudioNext]);

  return { available, address, chainId, onStudioNext, connecting, error, kit, connect, switchNetwork, requestTestFunds };
}
