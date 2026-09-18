/**
 * Full-consensus smoke test against the deployed contract on Studio Next.
 * Re-assesses HLUSD with the public "unclear" fixture (validators must fetch
 * it and agree on INSUFFICIENT_EVIDENCE), then proves request_exposure reverts
 * and leaves state unchanged. Idempotent for the demo: HLUSD stays blocked.
 */
import {
  DEPLOYMENT_FILE,
  FIXTURES,
  assertFixturesPublic,
  checkNetwork,
  ensureFunded,
  makeClients,
  readJson,
  withRetry,
  write,
  type Deployment,
} from "./lib.ts";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const deployment = readJson<Deployment>(DEPLOYMENT_FILE);
  if (!deployment) throw new Error("No deployment; run npm run deploy first");
  await checkNetwork();
  await assertFixturesPublic();
  const { account, client, reader } = makeClients();
  await ensureFunded(account.address);
  const address = deployment.contractAddress;
  type Dash = {
    assets: { asset_id: string; latest_assessment_id: number }[];
    latest: Record<string, { id?: number; status?: string; sources?: { fetch: string; authoritative: boolean }[] }>;
    summary: { assessment_count: number; exposure_request_count: number };
    policy: { policy_id: string };
  };
  const dash = async () =>
    (await withRetry("get_dashboard", () =>
      reader.readContract({ address, functionName: "get_dashboard", args: [10], jsonSafeReturn: true }),
    )) as Dash;

  const before = await dash();
  check("contract readable on Studio Next", before.policy.policy_id === "RG-TREASURY-REDEMPTION-v1", address);
  check("two monitored assets", before.assets.length === 2, before.assets.map((a) => a.asset_id).join(","));

  const assess = await write(client, address, "assess_asset", ["HLUSD", JSON.stringify([FIXTURES().unclear])], "assess_asset(HLUSD, unclear)");
  check("assessment executed with consensus", assess.successful && assess.executionResultName === "FINISHED_WITH_RETURN", `${assess.statusName}, ${assess.validators ?? "?"} validators`);
  const mid = await dash();
  const latest = mid.latest.HLUSD;
  check("new assessment persisted", mid.summary.assessment_count === before.summary.assessment_count + 1, `#${latest.id}`);
  check("validators agreed on INSUFFICIENT_EVIDENCE", latest.status === "INSUFFICIENT_EVIDENCE", String(latest.status));
  check("source fetched by validators from public HTTPS", latest.sources?.[0]?.fetch === "OK" && latest.sources?.[0]?.authoritative === true);

  const exposure = await write(client, address, "request_exposure", ["HLUSD", 1234], "request_exposure(HLUSD)", { simulateFees: false });
  const after = await dash();
  check("blocked exposure reverted", !exposure.successful && /EXPOSURE_BLOCKED/.test(exposure.errorText ?? ""), exposure.errorText ?? exposure.executionResultName);
  check("no exposure recorded", after.summary.exposure_request_count === mid.summary.exposure_request_count);

  console.log(`\n${failures === 0 ? "Studio Next smoke test passed" : `${failures} check(s) failed`}`);
  console.log(`assess tx:   ${assess.explorer}\nexposure tx: ${exposure.explorer}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`Smoke test error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
