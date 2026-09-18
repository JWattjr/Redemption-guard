/**
 * One-command Studio Next deployment:
 *   1. verify chain 61997 and public fixtures,
 *   2. fund the local deployer via sim_fundAccount,
 *   3. deploy contracts/redemption_guard.py,
 *   4. register the two demo assets,
 *   5. write deployments/studio-next.json and frontend/lib/deployment.generated.json.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CHAIN_ID,
  DEMO_ASSETS,
  DEPLOYMENT_FILE,
  EXPLORER_URL,
  FIXTURE_BASE_URL,
  FRONTEND_DEPLOYMENT_FILE,
  RPC_URL,
  ROOT,
  assertFixturesPublic,
  checkNetwork,
  ensureFunded,
  feesFor,
  withRetry,
  write,
  explorerAddress,
  makeClients,
  waitOutcome,
  writeJson,
  type Deployment,
  type Hex,
} from "./lib.ts";

async function main() {
  const code = readFileSync(resolve(ROOT, "contracts", "redemption_guard.py"), "utf8");
  const runner = code.split("\n", 1)[0];
  if (!/py-genlayer:[0-9a-z]{40,}/.test(runner) || /:(test|latest)"/.test(runner)) {
    throw new Error(`Contract header must pin a concrete runner, got: ${runner}`);
  }

  console.log(`Studio Next ${RPC_URL} (chain ${CHAIN_ID})`);
  await checkNetwork();
  await assertFixturesPublic();
  console.log(`Fixtures reachable at ${FIXTURE_BASE_URL}/evidence/`);

  const { account, client, reader } = makeClients();
  const balance = await ensureFunded(account.address);
  console.log(`Deployer ${account.address} balance ${balance} wei`);

  const deployFees = await feesFor(client);
  const deployHash = (await withRetry("deployContract", () => client.deployContract({ code, args: [], fees: deployFees as never }))) as Hex;
  const deployTx = await waitOutcome(client, deployHash, "deploy");
  if (!deployTx.successful) throw new Error("Deployment did not execute successfully");
  const receipt = await withRetry("getTransaction", () => client.getTransaction({ hash: deployHash as never }));
  const decoded = receipt.txDataDecoded as { contractAddress?: string } | undefined;
  const contractAddress = (decoded?.contractAddress ?? (receipt.data as { contract_address?: string })?.contract_address) as Hex;
  if (!contractAddress?.startsWith("0x")) throw new Error("Could not read deployed contract address");
  console.log(`Contract ${contractAddress}`);

  const assets: Deployment["assets"] = [];
  for (const asset of DEMO_ASSETS()) {
    const tx = await write(
      client,
      contractAddress,
      "register_asset",
      [asset.assetId, asset.name, asset.issuer, JSON.stringify(asset.domains)],
      `register ${asset.assetId}`,
    );
    if (!tx.successful) throw new Error(`register_asset ${asset.assetId} failed: ${tx.errorText ?? tx.executionResultName}`);
    assets.push({ ...asset, tx });
  }

  // Confirm resulting state from an account-free reader, not just the receipts.
  const onChain = (await withRetry("read get_assets", () =>
    reader.readContract({ address: contractAddress, functionName: "get_assets", args: [], jsonSafeReturn: true }),
  )) as { asset_id: string }[];
  const ids = onChain.map((a) => a.asset_id).join(",");
  if (ids !== DEMO_ASSETS().map((a) => a.assetId).join(",")) throw new Error(`Unexpected on-chain assets: ${ids}`);

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
  writeJson(DEPLOYMENT_FILE, deployment);
  writeJson(FRONTEND_DEPLOYMENT_FILE, {
    contractAddress,
    chainId: CHAIN_ID,
    deployedAt: deployment.deployedAt,
    deployTx: deployHash,
    fixtureBaseUrl: FIXTURE_BASE_URL,
  });
  console.log(`\nDeployed and verified: ${ids}`);
  console.log(`Explorer: ${explorerAddress(contractAddress)}`);
  console.log(`Wrote ${DEPLOYMENT_FILE}\nWrote ${FRONTEND_DEPLOYMENT_FILE}`);
}

main().catch((err) => {
  console.error(`\nDeploy failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
