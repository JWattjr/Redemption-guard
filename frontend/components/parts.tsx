"use client";

import type { Assessment, Asset, Exposure, Policy, Status } from "@/lib/contract";
import { STATUS_META } from "@/lib/contract";
import { explorerAddress, explorerTx as explorerTxUrl } from "@/lib/config";

export function short(value: string, head = 6, tail = 4) {
  return value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

export function when(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Fixed locale and UTC so prerendered HTML and the browser render identical text.
  return `${d.toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} UTC`;
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
    <span className={`badge badge--${meta.tone} badge--${size}`}>
      <span className="badge__dot" aria-hidden />
      {meta.label}
    </span>
  );
}

export function ReasonCodes({ codes }: { codes: string[] }) {
  return (
    <ul className="codes" aria-label="Reason codes">
      {codes.map((c) => (
        <li key={c} className="code">
          {c}
        </li>
      ))}
    </ul>
  );
}

export function EvidenceList({ assessment }: { assessment: Assessment }) {
  return (
    <ul className="evidence">
      {assessment.sources.map((s) => {
        const supports = assessment.supporting_urls.includes(s.url);
        return (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer noopener" className="evidence__url">
              {s.url.replace(/^https:\/\//, "")}
            </a>
            <span className="evidence__tags">
              <span className={`tag ${s.authoritative ? "tag--ok" : "tag--muted"}`}>
                {s.authoritative ? "Registered issuer domain" : "Not an issuer domain"}
              </span>
              <span className={`tag ${s.fetch === "OK" ? "tag--muted" : "tag--warn"}`}>
                {s.fetch === "OK" ? "Fetched by validators" : `Fetch: ${s.fetch}`}
              </span>
              {supports && <span className="tag tag--ink">Cited as support</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function AssetCard({
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
    <article className={`asset asset--${meta.tone} ${selected ? "asset--selected" : ""}`}>
      <header className="asset__head">
        <div>
          <div className="asset__ticker">{asset.asset_id}</div>
          <div className="asset__name">{asset.name}</div>
          <div className="asset__issuer">{asset.issuer}</div>
        </div>
        <StatusBadge status={asset.latest_status} size="lg" />
      </header>

      <div className={`gate ${open ? "gate--open" : "gate--closed"}`}>
        <span className="gate__label">Exposure gate</span>
        <span className="gate__value">{open ? "Open" : "Closed"}</span>
        <span className="gate__note">
          {cooling ? `Gate re-opens at ${utcTime(asset.gate_open_at)}` : meta.gate}
        </span>
      </div>

      {latest ? (
        <div className="asset__body">
          <p className="asset__reasoning">{latest.reasoning}</p>
          <ReasonCodes codes={latest.reason_codes} />
          <dl className="facts">
            <div>
              <dt>Assessment</dt>
              <dd>#{latest.id}</dd>
            </div>
            <div>
              <dt>Assessed</dt>
              <dd>{when(latest.assessed_at)}</dd>
            </div>
            <div>
              <dt>Approved exposure</dt>
              <dd className="mono">{groupUnits(asset.approved_exposure_units)} units</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="asset__body asset__body--empty">
          <p>No assessment on-chain yet. Until validators agree on one, the gate stays closed.</p>
        </div>
      )}

      <footer className="asset__foot">
        <span className="muted">Issuer domain: {asset.authoritative_domains.join(", ")}</span>
        <button type="button" className="btn btn--quiet" onClick={onSelect} aria-pressed={selected}>
          {selected ? "Selected" : "Select asset"}
        </button>
      </footer>
    </article>
  );
}

export function PolicyPanel({ policy }: { policy?: Policy }) {
  return (
    <section className="panel" aria-labelledby="policy-title">
      <div className="panel__head">
        <h2 id="policy-title">Frozen policy</h2>
        {policy && <span className="mono muted">{policy.policy_id}</span>}
      </div>
      <blockquote className="policy">
        {policy?.text ??
          "New exposure is eligible only when authoritative evidence clearly refers to the correct asset and indicates that ordinary redemptions remain operational. Return RESTRICTED when authoritative evidence reports an active suspension, material delay, broad restriction, or equivalent redemption impairment. Return INSUFFICIENT_EVIDENCE when sources are missing, ambiguous, stale, contradictory, non-authoritative, or cannot be tied confidently to the asset."}
      </blockquote>
      <ul className="policy__rules">
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
      </ul>
    </section>
  );
}

export function ContractPanel({ address, owner }: { address: string; owner?: string }) {
  return (
    <section className="panel" aria-labelledby="contract-title">
      <div className="panel__head">
        <h2 id="contract-title">Contract</h2>
      </div>
      <dl className="facts facts--stack">
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
          <dd>GenLayer Studio Next · chain 61997</dd>
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
    <section className="panel" aria-labelledby="activity-title">
      <div className="panel__head">
        <h2 id="activity-title">On-chain activity</h2>
        <span className="muted">{items.length ? `${items.length} records` : ""}</span>
      </div>
      {items.length === 0 ? (
        <p className="muted">No assessments or exposure requests recorded yet.</p>
      ) : (
        <ol className="activity">
          {items.slice(0, 12).map((row) =>
            row.kind === "assessment" ? (
              <li key={`a${row.item.id}`} className="activity__row">
                <span className="activity__kind">Assessment #{row.item.id}</span>
                <span className="activity__what">
                  <strong>{row.item.asset_id}</strong> <StatusBadge status={row.item.status} />
                </span>
                <span className="activity__when">{when(row.at)}</span>
              </li>
            ) : (
              <li key={`e${row.item.id}`} className="activity__row">
                <span className="activity__kind">Exposure #{row.item.id}</span>
                <span className="activity__what">
                  <strong>{row.item.asset_id}</strong>{" "}
                  <span className="mono">{groupUnits(row.item.amount_units)} units</span>{" "}
                  <span className="muted">under assessment #{row.item.assessment_id}</span>
                </span>
                <span className="activity__when">{when(row.at)}</span>
              </li>
            ),
          )}
        </ol>
      )}
      <p className="footnote">
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

export function ProofPanel({ proof, contractAddress }: { proof: { contractAddress: string; generatedAt: string; flows: ProofFlow[] }; contractAddress: string }) {
  if (proof.contractAddress.toLowerCase() !== contractAddress.toLowerCase() || proof.flows.length === 0) return null;
  return (
    <section className="panel" aria-labelledby="proof-title">
      <div className="panel__head">
        <h2 id="proof-title">Proof transactions</h2>
        <span className="muted small">Seeded {when(proof.generatedAt)} · re-read from chain</span>
      </div>
      <p className="panel__lede">
        The three reference flows, recorded by <code>npm run deploy:demo</code> against this contract. Blocked requests appear
        here because a reverted transaction leaves no contract state.
      </p>
      <ol className="proofs">
        {proof.flows.map((f) => {
          const agree = f.assess.votes ? Object.values(f.assess.votes).filter((v) => v === "agree").length : undefined;
          return (
            <li key={f.assess.hash} className="proof">
              <div className="proof__head">
                <strong className="mono">{f.assetId}</strong>
                <StatusBadge status={f.status as Status} />
                <span className={`tag ${f.exposureAllowed ? "tag--ok" : "tag--warn"}`}>
                  Exposure {f.exposureAllowed ? "recorded" : "blocked"}
                </span>
              </div>
              <dl className="proof__txs">
                <div>
                  <dt>Assessment #{f.assessmentId}</dt>
                  <dd>
                    <a className="mono" href={explorerTxUrl(f.assess.hash)} target="_blank" rel="noreferrer noopener">
                      {short(f.assess.hash, 10, 6)}
                    </a>{" "}
                    <span className="muted small">
                      {f.assess.executionResultName}
                      {f.assess.validators ? ` · ${agree ?? "?"}/${f.assess.validators} agree` : ""}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Exposure request</dt>
                  <dd>
                    <a className="mono" href={explorerTxUrl(f.exposure.hash)} target="_blank" rel="noreferrer noopener">
                      {short(f.exposure.hash, 10, 6)}
                    </a>{" "}
                    <span className="muted small">{f.exposure.executionResultName}</span>
                    {f.exposure.errorText && <div className="small text-restricted mono break">{f.exposure.errorText}</div>}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
