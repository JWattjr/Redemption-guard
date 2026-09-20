/** Deploy Redemption Guard v2 without touching the v1 deployment or proof files. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CHAIN_ID,
  DEMO_ASSETS,
  EXPLORER_URL,
  FIXTURE_BASE_URL,
  FIXTURES,
  RPC_URL,
  ROOT,
  V2_DEPLOYMENT_FILE,
  V2_FRONTEND_DEPLOYMENT_FILE,
  assertFixturesPublic,
  checkNetwork,
  ensureFunded,
  explorerAddress,
  feesFor,
  makeClients,
  waitOutcome,
  withRetry,
  write,
  writeJson,
  type Deployment,
  type Hex,
} from "./lib.ts";

async function main() {
  const code = readFileSync(resolve(ROOT, "contracts", "redemption_guard_v2.py"), "utf8");
  const runner = code.split("\n", 1)[0];
  if (!/py-genlayer:[0-9a-z]{40,}/.test(runner) || /:(test|latest)"/.test(runner)) {
    throw new Error(`v2 contract header must pin a concrete runner, got: ${runner}`);
  }
  console.log(`Studio Next ${RPC_URL} (chain ${CHAIN_ID}) — v2 additive deployment`);
  await checkNetwork();
  await assertFixturesPublic();
  const { account, client, reader } = makeClients();
  const balance = await ensureFunded(account.address);
  console.log(`Deployer ${account.address} balance ${balance} wei`);
  const deployFees = await feesFor(client);
  const deployHash = (await withRetry("deployContract v2", () => client.deployContract({ code, args: [], fees: deployFees as never }))) as Hex;
  const deployTx = await waitOutcome(client, deployHash, "deploy v2");
  if (!deployTx.successful) throw new Error("v2 deployment did not execute successfully");
  const receipt = await withRetry("getTransaction v2", () => client.getTransaction({ hash: deployHash as never }));
  const decoded = receipt.txDataDecoded as { contractAddress?: string } | undefined;
  const contractAddress = (decoded?.contractAddress ?? (receipt.data as { contract_address?: string })?.contract_address) as Hex;
  if (!contractAddress?.startsWith("0x")) throw new Error("Could not read v2 deployed contract address");
  const assets: Deployment["assets"] = [];
  const fixtures = FIXTURES();
  for (const asset of DEMO_ASSETS()) {
    const requiredSource = asset.assetId === "NWUSD" ? fixtures.operational : fixtures.suspended;
    const tx = await write(
      client,
      contractAddress,
      "register_asset",
      [asset.assetId, asset.name, asset.issuer, JSON.stringify(asset.domains), JSON.stringify([requiredSource]), 1, 10n ** 30n, 10n ** 30n, 1],
      `register v2 ${asset.assetId}`,
    );
    if (!tx.successful) throw new Error(`v2 register_asset ${asset.assetId} failed: ${tx.errorText ?? tx.executionResultName}`);
    assets.push({ ...asset, tx });
  }
  const onChain = (await withRetry("read v2 policy", () => reader.readContract({ address: contractAddress, functionName: "get_policy", args: [], jsonSafeReturn: true }))) as { policy_id: string };
  if (onChain.policy_id !== "RG-TREASURY-REDEMPTION-v2") throw new Error(`Unexpected v2 policy: ${onChain.policy_id}`);
  const deployment: Deployment = {
    network: "studio-next",
    chainId: CHAIN_ID,
    rpcUrl: RPC_URL,
    explorerUrl: EXPLORER_URL,
    contractAddress,
    deployTx,
    deployer: account.address,
    deployedAt: new Date().toISOString(),
    runner: runner.replace(/^#\s*/, ""),
    fixtureBaseUrl: FIXTURE_BASE_URL,
    assets,
  };
  writeJson(V2_DEPLOYMENT_FILE, deployment);
  writeJson(V2_FRONTEND_DEPLOYMENT_FILE, { version: 2, contractAddress, chainId: CHAIN_ID, deployedAt: deployment.deployedAt, deployTx: deployHash, fixtureBaseUrl: FIXTURE_BASE_URL });
  console.log(`v2 contract ${contractAddress}`);
  console.log(`Explorer: ${explorerAddress(contractAddress)}`);
  console.log(`Wrote ${V2_DEPLOYMENT_FILE}`);
  console.log(`Wrote ${V2_FRONTEND_DEPLOYMENT_FILE}`);
}

main().catch((err) => {
  console.error(`\nv2 deployment failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
