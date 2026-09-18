/**
 * Produce the three on-chain demonstration flows against the deployed contract:
 *   A. HLUSD + suspension notice   -> RESTRICTED            -> exposure blocked
 *   B. HLUSD + unclear update      -> INSUFFICIENT_EVIDENCE -> exposure blocked
 *   C. NWUSD + operational notice  -> ELIGIBLE              -> exposure recorded
 * Order leaves the dashboard with one ELIGIBLE and one blocked asset.
 * Every result is read back from chain state; nothing is assumed from receipts.
 */
import {
  DEPLOYMENT_FILE,
  FIXTURES,
  PROOF_FILE,
  assertFixturesPublic,
  checkNetwork,
  ensureFunded,
  makeClients,
  readJson,
  withRetry,
  write,
  writeFrontendProof,
  writeJson,
  type Deployment,
  type TxOutcome,
} from "./lib.ts";

type Flow = {
  name: string;
  assetId: string;
  evidenceUrl: string;
  expectedStatus: "ELIGIBLE" | "RESTRICTED" | "INSUFFICIENT_EVIDENCE";
  amountUnits: number;
};

type FlowProof = Flow & {
  assessTx: TxOutcome;
  onChainStatus: string;
  assessmentId: number;
  reasoning: string;
  reasonCodes: string[];
  exposureTx: TxOutcome;
  exposureAllowed: boolean;
  exposureCountAfter: number;
  matchesExpectation: boolean;
};

async function main() {
  const deployment = readJson<Deployment>(DEPLOYMENT_FILE);
  if (!deployment) throw new Error(`Run \`npm run deploy\` first (${DEPLOYMENT_FILE} missing)`);
  await checkNetwork();
  await assertFixturesPublic();
  const { account, client, reader } = makeClients();
  await ensureFunded(account.address);
  const address = deployment.contractAddress;
  const fx = FIXTURES();

  const read = async <T>(functionName: string, args: (string | number)[] = []) =>
    (await withRetry(`read ${functionName}`, () => reader.readContract({ address, functionName, args, jsonSafeReturn: true }))) as T;

  const flows: Flow[] = [
    { name: "RESTRICTED then blocked exposure", assetId: "HLUSD", evidenceUrl: fx.suspended, expectedStatus: "RESTRICTED", amountUnits: 100_000 },
    { name: "INSUFFICIENT_EVIDENCE then blocked exposure", assetId: "HLUSD", evidenceUrl: fx.unclear, expectedStatus: "INSUFFICIENT_EVIDENCE", amountUnits: 100_000 },
    { name: "ELIGIBLE then successful exposure", assetId: "NWUSD", evidenceUrl: fx.operational, expectedStatus: "ELIGIBLE", amountUnits: 250_000 },
  ];

  const proofs: FlowProof[] = [];
  for (const flow of flows) {
    console.log(`\n▶ ${flow.name} (${flow.assetId})`);
    const assessTx = await write(client, address, "assess_asset", [flow.assetId, JSON.stringify([flow.evidenceUrl])], "assess_asset");
    if (!assessTx.successful) throw new Error(`assess_asset did not execute: ${assessTx.errorText ?? assessTx.executionResultName}`);
    const latest = await read<{ id: number; status: string; reasoning: string; reason_codes: string[] }>("get_latest_assessment", [flow.assetId]);
    console.log(`  on-chain status: ${latest.status} (#${latest.id}) ${latest.reason_codes.join(", ")}`);
    console.log(`  reasoning: ${latest.reasoning}`);

    const before = (await read<{ exposure_request_count: number }>("get_summary")).exposure_request_count;
    const exposureTx = await write(client, address, "request_exposure", [flow.assetId, flow.amountUnits], "request_exposure", {
      simulateFees: latest.status === "ELIGIBLE",
    });
    const after = (await read<{ exposure_request_count: number }>("get_summary")).exposure_request_count;
    const exposureAllowed = exposureTx.successful && after === before + 1;
    const expectAllowed = flow.expectedStatus === "ELIGIBLE";
    const matchesExpectation = latest.status === flow.expectedStatus && exposureAllowed === expectAllowed;
    console.log(`  exposure ${exposureAllowed ? "RECORDED" : "BLOCKED"}; exposure count ${before} -> ${after}; ${matchesExpectation ? "as expected" : "UNEXPECTED"}`);
    proofs.push({
      ...flow,
      assessTx,
      onChainStatus: latest.status,
      assessmentId: latest.id,
      reasoning: latest.reasoning,
      reasonCodes: latest.reason_codes,
      exposureTx,
      exposureAllowed,
      exposureCountAfter: after,
      matchesExpectation,
    });
  }

  const summary = await read<Record<string, unknown>>("get_summary");
  const proof = {
    contractAddress: address,
    network: "studio-next",
    chainId: deployment.chainId,
    generatedAt: new Date().toISOString(),
    flows: proofs,
    finalSummary: summary,
  };
  writeJson(PROOF_FILE, proof);
  writeFrontendProof(proof);
  console.log(`\nFinal summary: ${JSON.stringify(summary)}`);
  console.log(`Wrote ${PROOF_FILE}`);
  if (proofs.some((p) => !p.matchesExpectation)) {
    console.error("One or more flows did not match expectations — see demo-proof.json.");
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(`\nSeed failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
