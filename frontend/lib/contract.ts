import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { CONTRACT_ADDRESS, STUDIO_NEXT } from "./config";

export type Status = "ELIGIBLE" | "RESTRICTED" | "INSUFFICIENT_EVIDENCE";

export type SourceSummary = { url: string; host: string; authoritative: boolean; fetch: string };

export type Assessment = {
  id: number;
  asset_id: string;
  status: Status;
  reasoning: string;
  reason_codes: string[];
  supporting_urls: string[];
  evidence_urls: string[];
  sources: SourceSummary[];
  policy_id: string;
  source_policy_version?: number;
  requested_by: string;
  assessed_at: string;
  gate_open_at: string | null;
  expires_at?: string | null;
};

export type Asset = {
  asset_id: string;
  name: string;
  issuer: string;
  authoritative_domains: string[];
  registered_at: string;
  latest_assessment_id: number;
  latest_status: Status | "";
  gate_open_at: string | null;
  gate_open: boolean;
  approved_exposure_units: string;
  required_sources?: string[];
  source_policy_version?: number;
  exposure_cap_units?: string;
  beneficiary_cap_units?: string;
  remaining_exposure_units?: string;
};

export type Exposure = {
  id: number;
  asset_id: string;
  amount_units: string;
  assessment_id: number;
  requested_by: string;
  requested_at: string;
};

export type Policy = {
  policy_id: string;
  text: string;
  statuses: Status[];
  reason_codes: string[];
  max_assets: number;
  max_urls: number;
  stale_after_days: number;
  restricted_to_eligible_cooldown_seconds: number;
  roles?: string[];
  default_assessment_validity_seconds?: number;
  beneficiary_must_be_caller?: boolean;
};

export type Summary = {
  asset_count: number;
  assessment_count: number;
  exposure_request_count: number;
  status_counts: Record<Status, number>;
  eligible_assets: string[];
  paused?: boolean;
  pause_reason?: string;
};

export type Dashboard = {
  policy: Policy;
  assets: Asset[];
  latest: Record<string, Assessment | null>;
  assessments: Assessment[];
  exposures: Exposure[];
  summary: Summary;
  owner: string;
  fetchedAt: number;
};

/** Account-free reader: views never need a wallet. */
export const reader = createClient({ chain: studioDevnet, endpoint: STUDIO_NEXT.rpcUrl });

async function view<T>(functionName: string, args: (string | number)[] = []): Promise<T> {
  return (await reader.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    jsonSafeReturn: true,
  })) as T;
}

/** One gen_call per refresh: Studio Next rate-limits gen_call (30/min per client). */
export async function fetchDashboard(): Promise<Dashboard> {
  const raw = await view<Omit<Dashboard, "latest" | "fetchedAt"> & { latest: Record<string, Assessment | Record<string, never>> }>(
    "get_dashboard",
    [20],
  );
  const latest: Record<string, Assessment | null> = {};
  for (const [id, a] of Object.entries(raw.latest)) latest[id] = "id" in a ? (a as Assessment) : null;
  return { ...raw, latest, fetchedAt: Date.now() };
}

type RawTx = {
  status?: string;
  txExecutionResultName?: string;
  num_of_initial_validators?: number;
  consensus_data?: { votes?: Record<string, string>; leader_receipt?: { result?: string }[] };
};

export type TxDetails = {
  statusName?: string;
  executionResultName?: string;
  validators?: number;
  agreeVotes?: number;
  resultCode?: number;
  errorText?: string;
};

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Studio Next keeps the leader's result in consensus_data.leader_receipt[0].result:
 * base64 of a result code byte (0 return, 1 user error, 2 VM error) + payload.
 * We decode it to show *why* the contract rejected a request.
 */
export async function fetchTxDetails(hash: string): Promise<TxDetails> {
  const res = await fetch(STUDIO_NEXT.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash", params: [hash] }),
  });
  const body = (await res.json()) as { result?: RawTx };
  const tx = body.result;
  const details: TxDetails = {
    statusName: tx?.status,
    executionResultName: tx?.txExecutionResultName,
    validators: tx?.num_of_initial_validators,
    agreeVotes: tx?.consensus_data?.votes
      ? Object.values(tx.consensus_data.votes).filter((v) => v === "agree").length
      : undefined,
  };
  const raw = tx?.consensus_data?.leader_receipt?.[0]?.result;
  if (raw) {
    const bytes = decodeBase64(raw);
    details.resultCode = bytes[0];
    if (bytes[0] !== 0) details.errorText = new TextDecoder().decode(bytes.subarray(1)).slice(0, 300);
  }
  return details;
}

export const STATUS_META: Record<Status | "", { label: string; tone: string; gate: string }> = {
  // The contract's own tokens, printed verbatim so the board and the frozen
  // policy on the same screen never disagree.
  ELIGIBLE: { label: "ELIGIBLE", tone: "eligible", gate: "New exposure permitted" },
  RESTRICTED: { label: "RESTRICTED", tone: "restricted", gate: "New exposure blocked" },
  INSUFFICIENT_EVIDENCE: { label: "INSUFFICIENT_EVIDENCE", tone: "insufficient", gate: "New exposure blocked" },
  "": { label: "NOT ASSESSED", tone: "none", gate: "New exposure blocked" },
};

export function isValidEvidenceUrl(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.length > 300) return "URL must be 300 characters or fewer";
  if (!v.startsWith("https://")) return "Only https:// URLs are accepted";
  try {
    const u = new URL(v);
    if (u.username || u.password) return "Credentials in URLs are not allowed";
    if (u.port && u.port !== "443") return "Only the default HTTPS port is accepted";
    if (!/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(u.hostname)) return "Use a public DNS hostname";
  } catch {
    return "Not a valid URL";
  }
  return null;
}
