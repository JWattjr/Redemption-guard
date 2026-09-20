"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TrackedStatus } from "@genlayer/transaction-kit-react";
import { CONTRACT_ADDRESS, DEPLOYMENT_VERSION, FIXTURES, STUDIO_NEXT, V2_CONTRACT_ADDRESS, explorerAddress, explorerTx } from "@/lib/config";
import {
  fetchDashboard,
  fetchTxDetails,
  isValidEvidenceUrl,
  STATUS_META,
  type Assessment,
  type Dashboard as DashboardData,
  type TxDetails,
} from "@/lib/contract";
import { useWallet } from "@/lib/wallet";
import { installRpcThrottle } from "@/lib/rpcThrottle";
import proof from "@/lib/proof.generated.json";
import { TxFlow, type TxRequest } from "./TxFlow";
import { BoardMark, GateFlap, Icon, StateBar, StatusIcon } from "./art";
import {
  Activity,
  AssetRow,
  ContractPanel,
  EvidenceList,
  PolicyPanel,
  ProofPanel,
  ReasonCodes,
  StatusBadge,
  groupUnits,
  short,
  utcTime,
  when,
} from "./parts";

const REFRESH_MS = 30_000;

installRpcThrottle();

type Outcome = {
  kind: TxRequest["kind"];
  assetId: string;
  hash?: string;
  tracked: TrackedStatus;
  details?: TxDetails;
  /** What the contract state says after the transaction, read independently. */
  confirmation: "pending" | "assessment-recorded" | "exposure-recorded" | "no-state-change" | "unconfirmed";
  assessment?: Assessment;
  amountUnits?: string;
};

export default function Dashboard() {
  const wallet = useWallet();
  const [data, setData] = useState<DashboardData>();
  const [loadError, setLoadError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState("NWUSD");
  const [urls, setUrls] = useState<string[]>([FIXTURES[0].url]);
  const [amount, setAmount] = useState("250000");
  const [request, setRequest] = useState<TxRequest & { assetId: string; amountUnits?: string }>();
  const [outcome, setOutcome] = useState<Outcome>();
  const [faucetMsg, setFaucetMsg] = useState<string>();
  const snapshotRef = useRef<{ latestId: number; exposures: number }>({ latestId: 0, exposures: 0 });

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      let next: DashboardData;
      try {
        next = await fetchDashboard();
      } catch (err) {
        // Studio Next allows 30 reads/min per client: surface it, back off, retry once.
        if (!/rate limit|429/i.test(String(err))) throw err;
        setLoadError(String(err));
        await new Promise((r) => setTimeout(r, 12_000));
        next = await fetchDashboard();
      }
      setData(next);
      setLoadError(undefined);
      return next;
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      return undefined;
    } finally {
      setRefreshing(false);
    }
  }, []);

  const busy = Boolean(request);
  useEffect(() => {
    // Pause background polling while a transaction is being tracked so the
    // tracker keeps Studio Next's per-client request budget.
    if (busy) return;
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh, busy]);

  const asset = data?.assets.find((a) => a.asset_id === selected);
  const latest = data?.latest[selected] ?? null;
  const gateOpen = Boolean(asset && (asset.gate_open ?? asset.latest_status === "ELIGIBLE"));

  const urlErrors = urls.map(isValidEvidenceUrl);
  const cleanUrls = urls.map((u) => u.trim()).filter(Boolean);
  const duplicate = new Set(cleanUrls).size !== cleanUrls.length;
  const assessDisabledReason = !wallet.address
    ? "Connect a wallet to submit"
    : !wallet.onStudioNext
      ? "Switch to Studio Next"
      : cleanUrls.length === 0
        ? "Add at least one evidence URL"
        : urlErrors.some(Boolean)
          ? "Fix the highlighted URL"
          : duplicate
            ? "Remove the duplicate URL"
            : undefined;

  const amountValid = /^[1-9]\d{0,29}$/.test(amount.trim());
  const exposureDisabledReason = !wallet.address
    ? "Connect a wallet to submit"
    : !wallet.onStudioNext
      ? "Switch to Studio Next"
      : !amountValid
        ? "Enter a positive whole number of units"
        : undefined;

  const begin = (req: TxRequest & { assetId: string; amountUnits?: string }) => {
    snapshotRef.current = {
      latestId: data?.assets.find((a) => a.asset_id === req.assetId)?.latest_assessment_id ?? 0,
      exposures: data?.summary.exposure_request_count ?? 0,
    };
    setOutcome(undefined);
    setRequest(req);
  };

  const submitAssessment = () =>
    begin({
      kind: "assess",
      title: `Assess ${selected} against the frozen policy`,
      method: "assess_asset",
      args: [selected, JSON.stringify(cleanUrls)],
      assetId: selected,
    });

  const submitExposure = () =>
    (() => {
      if (DEPLOYMENT_VERSION === "v2" && !wallet.address) return;
      const args =
        DEPLOYMENT_VERSION === "v2"
          ? [selected, BigInt(amount.trim()), wallet.address as string, `ui-${Date.now().toString(36)}`, Math.floor(Date.now() / 1000) + 3600]
          : [selected, BigInt(amount.trim())];
      begin({
        kind: "exposure",
        title: `Request ${groupUnits(amount.trim())} units of ${selected} exposure`,
        method: "request_exposure",
        args,
        assetId: selected,
        amountUnits: amount.trim(),
      });
    })();

  const onDone = useCallback(
    async (tracked: TrackedStatus) => {
      if (!request) return;
      const base: Outcome = {
        kind: request.kind,
        assetId: request.assetId,
        hash: tracked.genlayerTxId,
        tracked,
        confirmation: "pending",
        amountUnits: request.amountUnits,
      };
      setOutcome(base);
      const [details, first] = await Promise.all([
        tracked.genlayerTxId ? fetchTxDetails(tracked.genlayerTxId).catch(() => undefined) : undefined,
        refresh(),
      ]);
      let confirmation: Outcome["confirmation"] = "unconfirmed";
      let assessment: Assessment | undefined;
      // A rate-limited read must not be reported as "no state change": try once more.
      let next = first;
      if (!next) {
        await new Promise((r) => setTimeout(r, 8_000));
        next = await refresh();
      }
      if (next) {
        if (request.kind === "assess") {
          const a = next.assets.find((x) => x.asset_id === request.assetId);
          if (a && a.latest_assessment_id > snapshotRef.current.latestId) {
            confirmation = "assessment-recorded";
            assessment = next.latest[request.assetId] ?? undefined;
          } else {
            confirmation = "no-state-change";
          }
        } else {
          confirmation =
            next.summary.exposure_request_count > snapshotRef.current.exposures ? "exposure-recorded" : "no-state-change";
        }
      }
      setOutcome({ ...base, details, confirmation, assessment });
    },
    [request, refresh],
  );

  const closeFlow = useCallback(() => setRequest(undefined), []);

  const networkBadge = useMemo(() => {
    if (!wallet.available) return { tone: "idle", text: "Studio Next · read-only" };
    if (!wallet.address) return { tone: "idle", text: "Studio Next · 61997" };
    if (!wallet.onStudioNext) return { tone: "warn", text: `Wrong network (${wallet.chainId ?? "?"})` };
    return { tone: "ok", text: "Studio Next · 61997" };
  }, [wallet.available, wallet.address, wallet.onStudioNext, wallet.chainId]);

  const requestFunds = async () => {
    setFaucetMsg("Requesting test GEN…");
    try {
      setFaucetMsg(`Balance: ${await wallet.requestTestFunds()} (Studio Next test GEN)`);
    } catch (err) {
      setFaucetMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="shell">
      <header className="service">
        <div className="service__id">
          <BoardMark />
          <div>
            <div className="service__name">Redemption Guard</div>
            <div className="service__sub">Consensus-gated stablecoin exposure</div>
          </div>
        </div>
        <div className="service__state">
          <span className={`netbadge netbadge--${networkBadge.tone}`}>
            <span className="netbadge__dot" aria-hidden />
            {networkBadge.text}
          </span>
          {!wallet.available ? (
            <span className="service__note">No wallet detected</span>
          ) : !wallet.address ? (
            <button type="button" className="btn btn--primary" onClick={wallet.connect} disabled={wallet.connecting}>
              {wallet.connecting ? "Connecting…" : "Connect wallet"}
            </button>
          ) : !wallet.onStudioNext ? (
            <button type="button" className="btn btn--warn" onClick={wallet.switchNetwork}>
              Switch to Studio Next
            </button>
          ) : (
            <span className="wallet mono" title={wallet.address}>
              <span className="wallet__dot" aria-hidden />
              {short(wallet.address)}
            </span>
          )}
        </div>
      </header>

      <p className="notice" role="note">
        <strong>Authorization prototype — not financial advice.</strong> No tokens move. NWUSD and HLUSD are fictional
        assets; the built-in evidence pages are labeled synthetic reviewer fixtures. Studio Next is a release-candidate
        network and may reset.
      </p>

      {wallet.error && (
        <div className="alert alert--warn" role="alert">
          Wallet: {wallet.error}
        </div>
      )}
      {wallet.address && !wallet.onStudioNext && (
        <div className="alert alert--warn" role="alert">
          Your wallet is on chain {wallet.chainId}. Writes are disabled until you switch to GenLayer Studio Next (chain{" "}
          {STUDIO_NEXT.chainId}). Reads below still come straight from Studio Next.
        </div>
      )}
      {data?.summary.paused && (
        <div className="alert alert--warn" role="alert">
          Emergency pause active{data.summary.pause_reason ? `: ${data.summary.pause_reason}` : "."} New exposure is blocked.
        </div>
      )}

      <main className="grid">
        <div className="col col--main">
          <section className="board" aria-labelledby="assets-title">
            <div className="board__head">
              <h1 id="assets-title">Monitored assets</h1>
              <span className="stencil">Service board</span>
              <div className="board__meta">
                {data && <span className="board__read mono">Posted {utcTime(new Date(data.fetchedAt).toISOString())}</span>}
                <button
                  type="button"
                  className={`btn btn--quiet${refreshing ? " is-busy" : ""}`}
                  onClick={refresh}
                  disabled={refreshing}
                  aria-busy={refreshing}
                >
                  <Icon name="refresh" />
                  {refreshing ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>

            {loadError &&
              (/rate limit|429/i.test(loadError) ? (
                <div className="alert alert--warn" role="status">
                  Studio Next is rate-limiting reads (30 requests per minute). Retrying automatically…
                </div>
              ) : (
                <div className="alert alert--error" role="alert">
                  Could not read the contract on Studio Next: {loadError}. If Studio Next was reset, redeploy with{" "}
                  <code>npm run deploy:demo</code>.
                </div>
              ))}

            <div className="board__cols" aria-hidden>
              <span>Asset</span>
              <span>Posted status</span>
              <span>Exposure gate</span>
              <span>Record</span>
            </div>

            <div className="board__rows">
              {!data && !loadError
                ? [0, 1].map((i) => <div key={i} className="row row--waiting" aria-busy="true" />)
                : data?.assets.map((a) => (
                    <AssetRow
                      key={a.asset_id}
                      asset={a}
                      latest={data.latest[a.asset_id]}
                      selected={selected === a.asset_id}
                      onSelect={() => setSelected(a.asset_id)}
                    />
                  ))}
              {data && data.assets.length === 0 && (
                <p className="quiet">No assets registered. Run the deployment script to register the demo pair.</p>
              )}
            </div>
          </section>

          <div className="stations">
            <section className="panel panel--station" aria-labelledby="assess-title">
              <div className="panel__head">
                <h2 id="assess-title" className="step">
                  <span className="step__num">1</span>
                  <span className="step__sep">{" · "}</span>
                  Submit evidence
                </h2>
                <span className="stencil">Station 01</span>
                <AssetPicker
                  value={selected}
                  onChange={setSelected}
                  ids={data?.assets.map((a) => a.asset_id)}
                  label="Assessment asset"
                />
              </div>
              <p className="lede">
                Validators fetch these URLs themselves, judge them against the frozen policy, and must agree on the
                status before it is written.
              </p>
              <div className="fixtures">
                <span className="fixtures__label">Synthetic fixtures</span>
                {FIXTURES.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={`chip chip--${f.key}`}
                    title={f.hint}
                    onClick={() => {
                      setSelected(f.assetId);
                      setUrls([f.url]);
                    }}
                  >
                    <span className="chip__led" aria-hidden />
                    {f.label} <span className="chip__asset mono">{f.assetId}</span>
                  </button>
                ))}
              </div>
              <div className="urls">
                {urls.map((u, i) => (
                  <div key={i} className="urlrow">
                    <label className="sr-only" htmlFor={`url-${i}`}>
                      Evidence URL {i + 1}
                    </label>
                    <input
                      id={`url-${i}`}
                      className={`input mono ${urlErrors[i] ? "input--error" : ""}`}
                      value={u}
                      inputMode="url"
                      spellCheck={false}
                      placeholder="https://issuer.example/redemption-status"
                      onChange={(e) => setUrls(urls.map((x, j) => (j === i ? e.target.value : x)))}
                      aria-invalid={Boolean(urlErrors[i])}
                    />
                    {urls.length > 1 && (
                      <button
                        type="button"
                        className="btn btn--quiet btn--icon"
                        aria-label={`Remove URL ${i + 1}`}
                        onClick={() => setUrls(urls.filter((_, j) => j !== i))}
                      >
                        <Icon name="cross" />
                      </button>
                    )}
                    {urlErrors[i] && <span className="fielderror">{urlErrors[i]}</span>}
                  </div>
                ))}
              </div>
              <div className="panel__foot">
                <button
                  type="button"
                  className="btn btn--quiet"
                  disabled={urls.length >= 3}
                  onClick={() => setUrls([...urls, ""])}
                >
                  Add URL ({urls.length}/3)
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={submitAssessment}
                  disabled={Boolean(assessDisabledReason) || Boolean(request)}
                  title={assessDisabledReason}
                >
                  Run consensus assessment
                </button>
              </div>
              {assessDisabledReason && (
                <p className="hint">
                  <Icon name="lock" />
                  {assessDisabledReason}
                </p>
              )}
            </section>

            <section className="panel panel--station" aria-labelledby="exposure-title">
              <div className="panel__head">
                <h2 id="exposure-title" className="step">
                  <span className="step__num">2</span>
                  <span className="step__sep">{" · "}</span>
                  Request exposure
                </h2>
                <span className="stencil">Station 02</span>
                <AssetPicker
                  value={selected}
                  onChange={setSelected}
                  ids={data?.assets.map((a) => a.asset_id)}
                  label="Exposure asset"
                />
              </div>
              <p className="lede">
                Deterministic contract code checks the latest agreed status. Only <strong>ELIGIBLE</strong> records the
                request; anything else reverts.
              </p>
              <div className="gatecheck">
                <div className="gatecheck__head">
                  <span className="gatecheck__label mono">{selected}</span>
                  <StatusBadge status={asset?.latest_status ?? ""} />
                </div>
                <GateFlap open={gateOpen} />
                <p className="gatecheck__note">
                  {asset?.latest_status === "ELIGIBLE" && asset.gate_open === false && asset.gate_open_at
                    ? "This ELIGIBLE assessment is cooling down. Gate re-opens at " + utcTime(asset.gate_open_at) + "."
                    : asset?.latest_status === "ELIGIBLE"
                      ? `Contract should record this request (assessment #${latest?.id}).`
                      : "Contract should reject this request. Send it anyway to see the on-chain rejection."}
                </p>
              </div>
              <label className="field">
                <span className="field__label">Amount (whole units)</span>
                <input
                  className={`input mono ${amount && !amountValid ? "input--error" : ""}`}
                  value={amount}
                  inputMode="numeric"
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                  aria-invalid={Boolean(amount) && !amountValid}
                />
              </label>
              <div className="panel__foot">
                <span className="note note--inline">Authorization record only. No tokens move.</span>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={submitExposure}
                  disabled={Boolean(exposureDisabledReason) || Boolean(request)}
                  title={exposureDisabledReason}
                >
                  Request exposure
                </button>
              </div>
              {exposureDisabledReason && (
                <p className="hint">
                  <Icon name="lock" />
                  {exposureDisabledReason}
                </p>
              )}
            </section>
          </div>

          {outcome && <OutcomeCard outcome={outcome} />}

          <ProofPanel proof={proof} contractAddress={CONTRACT_ADDRESS} />

          {wallet.address && wallet.onStudioNext && (
            <div className="faucet">
              <button type="button" className="btn btn--quiet" onClick={requestFunds}>
                Get Studio Next test GEN for fees
              </button>
              {faucetMsg && (
                <span className="quiet" role="status">
                  {faucetMsg}
                </span>
              )}
            </div>
          )}
        </div>

        <aside className="col col--side">
          <PolicyPanel policy={data?.policy} />
          <Activity assessments={data?.assessments ?? []} exposures={data?.exposures ?? []} />
          <ContractPanel address={CONTRACT_ADDRESS} owner={data?.owner} v2Address={V2_CONTRACT_ADDRESS} deploymentVersion={DEPLOYMENT_VERSION} />
        </aside>
      </main>

      <footer className="pagefoot">
        <span>
          Redemption Guard · GenLayer Studio Next · contract{" "}
          <a href={explorerAddress(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer noopener" className="mono">
            {short(CONTRACT_ADDRESS, 8, 6)}
          </a>
        </span>
        <span>Authorization prototype. Not financial advice. No custody, swaps, or price feeds.</span>
      </footer>

      {request && wallet.kit && <TxFlow kit={wallet.kit} request={request} onClose={closeFlow} onDone={onDone} />}
    </div>
  );
}

function AssetPicker({
  value,
  onChange,
  ids,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  ids?: string[];
  label: string;
}) {
  const options = ids?.length ? ids : ["NWUSD", "HLUSD"];
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const move = (index: number) => {
    const next = options[(index + options.length) % options.length];
    onChange(next);
    requestAnimationFrame(() => buttons.current[next]?.focus());
  };
  return (
    <div
      className="picker"
      role="radiogroup"
      aria-label={label}
      onKeyDown={(event) => {
        const index = options.indexOf(value);
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          move(index + 1);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          move(index - 1);
        } else if (event.key === "Home") {
          event.preventDefault();
          move(0);
        } else if (event.key === "End") {
          event.preventDefault();
          move(options.length - 1);
        }
      }}
    >
      {options.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          tabIndex={value === id ? 0 : -1}
          ref={(element) => {
            buttons.current[id] = element;
          }}
          className={`picker__item ${value === id ? "is-active" : ""}`}
          onClick={() => onChange(id)}
        >
          {id}
        </button>
      ))}
    </div>
  );
}

function OutcomeCard({ outcome }: { outcome: Outcome }) {
  const { tracked, details } = outcome;
  const statusName = details?.statusName ?? tracked.statusName ?? tracked.phase;
  const execution = details?.executionResultName ?? tracked.executionResultName ?? "—";
  const finalized = statusName === "FINALIZED";
  const executed = execution === "FINISHED_WITH_RETURN" && tracked.successful !== false;

  let headline: string;
  let tone: string;
  if (outcome.confirmation === "pending") {
    headline = "Decided — confirming contract state…";
    tone = "none";
  } else if (outcome.kind === "assess") {
    if (outcome.confirmation === "assessment-recorded" && outcome.assessment) {
      headline = `Validators agreed: ${STATUS_META[outcome.assessment.status].label}`;
      tone = STATUS_META[outcome.assessment.status].tone;
    } else if (outcome.confirmation === "unconfirmed") {
      headline = "Could not confirm assessment outcome";
      tone = "none";
    } else {
      headline = "No assessment was recorded";
      tone = "restricted";
    }
  } else if (outcome.confirmation === "exposure-recorded") {
    headline = `Exposure recorded for ${outcome.assetId}`;
    tone = "eligible";
  } else if (outcome.confirmation === "no-state-change" && details?.errorText) {
    headline = `Exposure blocked for ${outcome.assetId}`;
    tone = "restricted";
  } else {
    headline = "Could not confirm exposure outcome";
    tone = "none";
  }

  return (
    <section className={`panel outcome outcome--${tone}`} aria-live="polite" aria-labelledby="outcome-title">
      <div className="panel__head">
        <h2 id="outcome-title" className="outcome__title">
          <span className="outcome__glyph" aria-hidden>
            {outcome.assessment ? (
              <StatusIcon status={outcome.assessment.status} />
            ) : outcome.confirmation === "exposure-recorded" ? (
              <Icon name="open" />
            ) : tone === "restricted" ? (
              <Icon name="lock" />
            ) : (
              <Icon name="dot" />
            )}
          </span>
          {headline}
        </h2>
        {outcome.assessment && <StateBar status={outcome.assessment.status} />}
      </div>

      {outcome.assessment && (
        <>
          <p className="outcome__reasoning">{outcome.assessment.reasoning}</p>
          {outcome.assessment.status === "ELIGIBLE" && outcome.assessment.gate_open_at && (
            <p className="outcome__cooldown">
              {new Date(outcome.assessment.gate_open_at).getTime() > new Date(outcome.assessment.assessed_at).getTime()
                ? "Gate re-opens at " + utcTime(outcome.assessment.gate_open_at) + "."
                : "Exposure gate is open."}
            </p>
          )}
          <ReasonCodes codes={outcome.assessment.reason_codes} />
          <EvidenceList assessment={outcome.assessment} />
        </>
      )}
      {outcome.kind === "exposure" && outcome.confirmation !== "pending" && (
        <p className="outcome__reasoning">
          {outcome.confirmation === "exposure-recorded"
            ? `${groupUnits(outcome.amountUnits ?? "0")} units recorded against the latest ELIGIBLE assessment.`
            : details?.errorText
              ? `Contract rejected the request: ${details.errorText}`
              : "The exposure count did not change, so the contract did not record this request."}
        </p>
      )}
      {outcome.kind === "assess" && outcome.confirmation === "no-state-change" && details?.errorText && (
        <p className="outcome__reasoning">Contract error: {details.errorText}</p>
      )}

      <dl className="specs specs--wide">
        <div>
          <dt>Transaction</dt>
          <dd className="mono break">
            {outcome.hash ? (
              <a href={explorerTx(outcome.hash)} target="_blank" rel="noreferrer noopener">
                {short(outcome.hash, 10, 8)}
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Lifecycle</dt>
          <dd>
            {statusName}
            {!finalized && <span className="mark-tag is-warn">not final</span>}
          </dd>
        </div>
        <div>
          <dt>Execution result</dt>
          <dd className={executed ? "" : "is-bad"}>{execution}</dd>
        </div>
        <div>
          <dt>Validators</dt>
          <dd>{details?.validators ? `${details.agreeVotes ?? "?"} agree of ${details.validators}` : "—"}</dd>
        </div>
        <div>
          <dt>State check</dt>
          <dd>
            {{
              pending: "Reading…",
              "assessment-recorded": "Assessment present in contract state",
              "exposure-recorded": "Exposure count increased",
              "no-state-change": "Contract state unchanged",
              unconfirmed: "Could not read state",
            }[outcome.confirmation]}
          </dd>
        </div>
        <div>
          <dt>Contract</dt>
          <dd className="mono">
            <a href={explorerAddress(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer noopener">
              {short(CONTRACT_ADDRESS, 8, 6)}
            </a>
          </dd>
        </div>
        {outcome.assessment && (
          <div>
            <dt>Recorded</dt>
            <dd>
              #{outcome.assessment.id} · {when(outcome.assessment.assessed_at)}
            </dd>
          </div>
        )}
      </dl>
      {!finalized && outcome.confirmation !== "pending" && (
        <p className="note">
          Shown at the decided stage for responsiveness. The lifecycle becomes FINALIZED after the appeal window.
        </p>
      )}
    </section>
  );
}
