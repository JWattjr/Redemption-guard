"use client";

import type { Assessment, Asset, Exposure, Policy, Status } from "@/lib/contract";
import { STATUS_META } from "@/lib/contract";
import { explorerAddress, explorerTx as explorerTxUrl } from "@/lib/config";
import { GateFlap, Icon, StateBar, StatusIcon } from "./art";

export function short(value: string, head = 6, tail = 4) {
  return value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

export function when(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Fixed locale and UTC so prerendered HTML and the browser render identical text.
  return `${d.toLocaleString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} UTC`;
}

export function utcTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false })} UTC`;
}

export function groupUnits(units: string) {
  return units.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function StatusBadge({ status, size = "md" }: { status: Status | ""; size?: "md" | "lg" }) {
  const meta = STATUS_META[status];
  return (
    <span className={`posted posted--${meta.tone} posted--${size}`}>
      <StatusIcon status={status} />
      {meta.label}
    </span>
  );
}

export function ReasonCodes({ codes }: { codes: string[] }) {
  return (
    <ul className="codes" aria-label="Reason codes">
      {codes.map((c) => (
        <li key={c} className="codes__item">
          {c}
        </li>
      ))}
    </ul>
  );
}

export function EvidenceList({ assessment }: { assessment: Assessment }) {
  return (
    <ul className="sources">
      {assessment.sources.map((s) => {
        const supports = assessment.supporting_urls.includes(s.url);
        return (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer noopener" className="sources__url mono">
              {s.url.replace(/^https:\/\//, "")}
            </a>
            <span className="sources__marks">
              <span className={`mark-tag ${s.authoritative ? "is-ok" : "is-off"}`}>
                <Icon name={s.authoritative ? "check" : "cross"} />
                {s.authoritative ? "Registered issuer domain" : "Not an issuer domain"}
              </span>
              <span className={`mark-tag ${s.fetch === "OK" ? "" : "is-warn"}`}>
                <Icon name="dot" />
                {s.fetch === "OK" ? "Fetched by validators" : `Fetch: ${s.fetch}`}
              </span>
              {supports && (
                <span className="mark-tag is-cited">
                  <Icon name="arrow" />
                  Cited as support
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** One asset posted on the board: ticker, status, gate, times, notes. */
export function AssetRow({
  asset,
  latest,
  selected,
  onSelect,
}: {
  asset: Asset;
  latest: Assessment | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = STATUS_META[asset.latest_status];
  const open = asset.gate_open ?? asset.latest_status === "ELIGIBLE";
  const cooling = asset.latest_status === "ELIGIBLE" && !open && asset.gate_open_at;
  return (
    <article className={`row row--${meta.tone}${selected ? " row--selected" : ""}`} aria-label={asset.asset_id}>
      <div className="row__asset">
        <span className="row__lamp" aria-hidden />
        <div>
          <div className="asset__ticker">{asset.asset_id}</div>
          <div className="row__name">{asset.name}</div>
          <div className="row__issuer">{asset.issuer}</div>
        </div>
      </div>

      <div className="row__status">
        <StatusBadge status={asset.latest_status} size="lg" />
        <StateBar status={asset.latest_status} />
      </div>

      <div className="row__gate">
        <GateFlap open={open} />
        <span className="row__gatenote">{cooling ? `Re-opens ${utcTime(asset.gate_open_at)}` : meta.gate}</span>
      </div>

      <dl className="row__data">
        <div>
          <dt>Assessment</dt>
          <dd>{latest ? `#${latest.id}` : "—"}</dd>
        </div>
        <div>
          <dt>Assessed</dt>
          <dd>{latest ? when(latest.assessed_at) : "—"}</dd>
        </div>
        <div>
          <dt>Approved exposure</dt>
          <dd className="mono">{groupUnits(asset.approved_exposure_units)} units</dd>
        </div>
        {asset.remaining_exposure_units && (
          <div>
            <dt>Remaining cap</dt>
            <dd className="mono">{groupUnits(asset.remaining_exposure_units)} units</dd>
          </div>
        )}
        {latest?.expires_at && (
          <div>
            <dt>Assessment valid</dt>
            <dd>{utcTime(latest.expires_at)}</dd>
          </div>
        )}
      </dl>

      <div className="row__notes">
        {latest ? (
          <>
            <p>{latest.reasoning}</p>
            <ReasonCodes codes={latest.reason_codes} />
          </>
        ) : (
          <p>No assessment on-chain yet. Until validators agree on one, the gate stays closed.</p>
        )}
        <div className="row__foot">
          <span className="row__domain">
            Issuer domain <span className="mono">{asset.authoritative_domains.join(", ")}</span>
          </span>
          <button type="button" className={`btn ${selected ? "btn--on" : "btn--quiet"}`} onClick={onSelect} aria-pressed={selected}>
            {selected && <Icon name="check" />}
            {selected ? "Selected" : "Select asset"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function PolicyPanel({ policy }: { policy?: Policy }) {
  return (
    <section className="plate" aria-labelledby="policy-title">
      <div className="plate__head">
        <h2 id="policy-title">Frozen policy</h2>
        <span className="stencil">{policy ? policy.policy_id : "RG-TREASURY-REDEMPTION-v1"}</span>
      </div>
      <blockquote className="policy">
        {policy?.text ??
          "New exposure is eligible only when authoritative evidence clearly refers to the correct asset and indicates that ordinary redemptions remain operational. Return RESTRICTED when authoritative evidence reports an active suspension, material delay, broad restriction, or equivalent redemption impairment. Return INSUFFICIENT_EVIDENCE when sources are missing, ambiguous, stale, contradictory, non-authoritative, or cannot be tied confidently to the asset."}
      </blockquote>
      <ul className="rules">
        <li>Stored in the contract as a constant. Nobody, including the owner, can edit it.</li>
        <li>Only sources on the asset&apos;s registered issuer domain count as authoritative.</li>
        <li>
          A decisive status with no authoritative supporting source is downgraded to INSUFFICIENT_EVIDENCE by
          deterministic code.
        </li>
        {policy && <li>Evidence older than {policy.stale_after_days} days is stale.</li>}
        {policy && (
          <li>
            A recovery from RESTRICTED to ELIGIBLE is recorded immediately but the gate re-opens after{" "}
            {Math.round((policy.restricted_to_eligible_cooldown_seconds ?? 3600) / 60)} minutes.
          </li>
        )}
        {policy?.roles && <li>Administrative actions use explicit {policy.roles.join(", ")} roles.</li>}
        {policy?.beneficiary_must_be_caller && <li>Exposure authorizations bind the beneficiary to the requesting wallet.</li>}
      </ul>
    </section>
  );
}

export function ContractPanel({ address, owner, v2Address, deploymentVersion = "v1" }: { address: string; owner?: string; v2Address?: string; deploymentVersion?: "v1" | "v2" }) {
  return (
    <section className="plate" aria-labelledby="contract-title">
      <div className="plate__head">
        <h2 id="contract-title">Contract</h2>
        <span className="stencil">CHAIN 61997</span>
      </div>
      <dl className="specs">
        <div>
          <dt>Address</dt>
          <dd className="mono break">
            <a href={explorerAddress(address)} target="_blank" rel="noreferrer noopener">
              {address}
            </a>
          </dd>
        </div>
        {owner && (
          <div>
            <dt>Owner</dt>
            <dd className="mono">{short(owner, 8, 6)}</dd>
          </div>
        )}
        <div>
          <dt>Network</dt>
          <dd>GenLayer Studio Next</dd>
        </div>
        <div>
          <dt>Deployment</dt>
          <dd>{deploymentVersion} active · v1 proof preserved</dd>
        </div>
        <div>
          <dt>v2 config</dt>
          <dd className="mono break">{v2Address ? v2Address : "not configured (opt-in only)"}</dd>
        </div>
        <div>
          <dt>Runner</dt>
          <dd className="mono break">py-genlayer:5jycge4q…qng</dd>
        </div>
      </dl>
    </section>
  );
}

type ActivityItem =
  | { kind: "assessment"; at: string; item: Assessment }
  | { kind: "exposure"; at: string; item: Exposure };

export function Activity({ assessments, exposures }: { assessments: Assessment[]; exposures: Exposure[] }) {
  const items: ActivityItem[] = [
    ...assessments.map((a) => ({ kind: "assessment" as const, at: a.assessed_at, item: a })),
    ...exposures.map((e) => ({ kind: "exposure" as const, at: e.requested_at, item: e })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.kind.localeCompare(a.kind)));

  return (
    <section className="plate" aria-labelledby="activity-title">
      <div className="plate__head">
        <h2 id="activity-title">On-chain activity</h2>
        <span className="stencil">{items.length ? `${items.length} records` : "log"}</span>
      </div>
      {items.length === 0 ? (
        <p className="quiet">No assessments or exposure requests recorded yet.</p>
      ) : (
        <ol className="log">
          {items.slice(0, 12).map((row) =>
            row.kind === "assessment" ? (
              <li key={`a${row.item.id}`} className="log__row">
                <span className="log__time mono">{when(row.at)}</span>
                <span className="log__what">
                  <span className="log__kind">Assessment #{row.item.id}</span>
                  <strong className="mono">{row.item.asset_id}</strong>
                  <StatusBadge status={row.item.status} />
                  <StateBar status={row.item.status} />
                </span>
              </li>
            ) : (
              <li key={`e${row.item.id}`} className="log__row">
                <span className="log__time mono">{when(row.at)}</span>
                <span className="log__what">
                  <span className="log__kind">Exposure #{row.item.id}</span>
                  <strong className="mono">{row.item.asset_id}</strong>
                  <span className="mono">{groupUnits(row.item.amount_units)} units</span>
                  <span className="quiet">under assessment #{row.item.assessment_id}</span>
                </span>
              </li>
            ),
          )}
        </ol>
      )}
      <p className="note">
        Blocked exposure requests revert, so they leave no record in contract state; they remain visible as failed
        transactions on the explorer.
      </p>
    </section>
  );
}

type ProofFlow = {
  name: string;
  assetId: string;
  status: string;
  assessmentId: number;
  exposureAllowed: boolean;
  assess: { hash: string; statusName: string; executionResultName: string; validators?: number; votes?: Record<string, string | undefined> };
  exposure: { hash: string; statusName: string; executionResultName: string; errorText?: string };
};

export function ProofPanel({
  proof,
  contractAddress,
}: {
  proof: { contractAddress: string; generatedAt: string; flows: ProofFlow[] };
  contractAddress: string;
}) {
  if (proof.contractAddress.toLowerCase() !== contractAddress.toLowerCase() || proof.flows.length === 0) return null;
  return (
    <section className="panel panel--proof" aria-labelledby="proof-title">
      <div className="panel__head">
        <h2 id="proof-title">Proof transactions</h2>
        <span className="stencil">Seeded {when(proof.generatedAt)} · re-read from chain</span>
      </div>
      <p className="lede">
        The three reference flows, recorded by <code>npm run deploy:demo</code> against this contract. Blocked requests
        appear here because a reverted transaction leaves no contract state.
      </p>
      <ol className="proofs">
        {proof.flows.map((f) => {
          const agree = f.assess.votes ? Object.values(f.assess.votes).filter((v) => v === "agree").length : undefined;
          return (
            <li key={f.assess.hash} className="proofs__row">
              <div className="proofs__asset">
                <strong className="mono">{f.assetId}</strong>
                <StatusBadge status={f.status as Status} />
                <StateBar status={f.status as Status} />
              </div>
              <div className="proofs__leg">
                <span className="proofs__label">Assessment #{f.assessmentId}</span>
                <a className="mono hash" href={explorerTxUrl(f.assess.hash)} target="_blank" rel="noreferrer noopener">
                  {short(f.assess.hash, 10, 6)}
                </a>
                <span className="proofs__meta">
                  {f.assess.executionResultName}
                  {f.assess.validators ? ` · ${agree ?? "?"}/${f.assess.validators} agree` : ""}
                </span>
              </div>
              <div className="proofs__leg">
                <span className="proofs__label">Exposure request</span>
                <a className="mono hash" href={explorerTxUrl(f.exposure.hash)} target="_blank" rel="noreferrer noopener">
                  {short(f.exposure.hash, 10, 6)}
                </a>
                <span className="proofs__meta">
                  <span className={f.exposureAllowed ? "is-recorded" : "is-blocked"}>
                    <Icon name={f.exposureAllowed ? "open" : "lock"} />
                    {f.exposureAllowed ? "Recorded" : "Blocked"}
                  </span>{" "}
                  {f.exposure.executionResultName}
                </span>
                {f.exposure.errorText && <code className="revert">{f.exposure.errorText}</code>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
