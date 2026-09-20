/** Seed v2 proof flows into separate v2 artifacts; v1 proofs are read-only. */
import {
  FIXTURES,
  V2_DEPLOYMENT_FILE,
  V2_FRONTEND_PROOF_FILE,
  V2_PROOF_FILE,
  assertFixturesPublic,
  checkNetwork,
  ensureFunded,
  makeClients,
  readJson,
  withRetry,
  write,
  writeJson,
  type Deployment,
  type TxOutcome,
} from "./lib.ts";

type Flow = { name: string; assetId: string; evidenceUrl: string; expectedStatus: "ELIGIBLE" | "RESTRICTED" | "INSUFFICIENT_EVIDENCE"; amountUnits: number };

async function main() {
  const deployment = readJson<Deployment>(V2_DEPLOYMENT_FILE);
  if (!deployment) throw new Error(`Run npm run deploy:v2 first (${V2_DEPLOYMENT_FILE} missing)`);
  await checkNetwork();
  await assertFixturesPublic();
  const { account, client, reader } = makeClients();
  await ensureFunded(account.address);
  const address = deployment.contractAddress;
  const fx = FIXTURES();
  const read = async <T>(functionName: string, args: (string | number)[] = []) =>
    (await withRetry(`read v2 ${functionName}`, () => reader.readContract({ address, functionName, args, jsonSafeReturn: true }))) as T;
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const flows: Flow[] = [
    { name: "RESTRICTED then blocked exposure", assetId: "HLUSD", evidenceUrl: fx.suspended, expectedStatus: "RESTRICTED", amountUnits: 100_000 },
    { name: "INSUFFICIENT_EVIDENCE then blocked exposure", assetId: "HLUSD", evidenceUrl: fx.unclear, expectedStatus: "INSUFFICIENT_EVIDENCE", amountUnits: 100_000 },
    { name: "ELIGIBLE then beneficiary exposure", assetId: "NWUSD", evidenceUrl: fx.operational, expectedStatus: "ELIGIBLE", amountUnits: 250_000 },
  ];
  const proofs: (Flow & { assessTx: TxOutcome; exposureTx: TxOutcome; onChainStatus: string; assessmentId: number; exposureAllowed: boolean; matchesExpectation: boolean })[] = [];
  for (const [index, flow] of flows.entries()) {
    const assessTx = await write(client, address, "assess_asset", [flow.assetId, JSON.stringify([flow.evidenceUrl])], `v2 assess ${flow.assetId}`);
    if (!assessTx.successful) throw new Error(`v2 assess_asset failed: ${assessTx.errorText ?? assessTx.executionResultName}`);
    const latest = await read<{ id: number; status: string }>("get_latest_assessment", [flow.assetId]);
    const before = (await read<{ exposure_request_count: number }>("get_summary")).exposure_request_count;
    const exposureTx = await write(client, address, "request_exposure", [flow.assetId, flow.amountUnits, account.address, `demo-v2-${index + 1}`, expiry], `v2 request ${flow.assetId}`, { simulateFees: latest.status === "ELIGIBLE" });
    const after = (await read<{ exposure_request_count: number }>("get_summary")).exposure_request_count;
    const exposureAllowed = exposureTx.successful && after === before + 1;
    proofs.push({ ...flow, assessTx, exposureTx, onChainStatus: latest.status, assessmentId: latest.id, exposureAllowed, matchesExpectation: latest.status === flow.expectedStatus && exposureAllowed === (flow.expectedStatus === "ELIGIBLE") });
  }
  const proof = { version: 2, contractAddress: address, network: "studio-next", chainId: deployment.chainId, generatedAt: new Date().toISOString(), flows: proofs, finalSummary: await read("get_summary") };
  writeJson(V2_PROOF_FILE, proof);
  writeJson(V2_FRONTEND_PROOF_FILE, { version: 2, contractAddress: address, generatedAt: proof.generatedAt, flows: proofs.map((flow) => ({ name: flow.name, assetId: flow.assetId, status: flow.onChainStatus, assessmentId: flow.assessmentId, exposureAllowed: flow.exposureAllowed, assess: { hash: flow.assessTx.hash, statusName: flow.assessTx.statusName, executionResultName: flow.assessTx.executionResultName }, exposure: { hash: flow.exposureTx.hash, statusName: flow.exposureTx.statusName, executionResultName: flow.exposureTx.executionResultName, errorText: flow.exposureTx.errorText } })) });
  console.log(`Wrote ${V2_PROOF_FILE}`);
  console.log(`Wrote ${V2_FRONTEND_PROOF_FILE}`);
  if (proofs.some((flow) => !flow.matchesExpectation)) process.exitCode = 2;
}

main().catch((err) => {
  console.error(`\nv2 seed failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
