/**
 * Build the checked-in Studio Next fee profile from finalized representative
 * transactions already recorded in deployments/*.json. This is read-only:
 * it never submits a transaction or changes contract state.
 */
import {
  DEPLOYMENT_FILE,
  PROOF_FILE,
  ROOT,
  makeClients,
  readJson,
  writeJson,
  type Deployment,
} from "./lib.ts";

const CHAIN_ID = 61997;
const PROFILE_FILE = `${ROOT}/frontend/fee-profile.json`;

type RecordLike = Record<string, unknown>;

type FeeDistribution = RecordLike & {
  leaderTimeunitsAllocation?: string | number | bigint;
  validatorTimeunitsAllocation?: string | number | bigint;
  executionBudgetPerRound?: string | number | bigint;
  totalMessageFees?: string | number | bigint;
  rotations?: Array<string | number | bigint>;
};

type ReceiptLike = {
  statusName?: string;
  data?: {
    fee_accounting?: {
      recommended_fee_preset?: { distribution?: FeeDistribution };
      fees_distribution?: FeeDistribution;
    };
  };
  fees?: { distribution?: FeeDistribution };
};

type ProofFile = {
  flows: Array<{
    assessTx: { hash: `0x${string}` };
    exposureTx: { hash: `0x${string}` };
  }>;
};

type ProfileEntry = {
  leaderTimeunitsAllocation: string;
  validatorTimeunitsAllocation: string;
  executionBudgetPerRound: string;
  totalMessageFees: string;
  rotationsPerRound: string;
};

const asBigInt = (value: unknown, fallback = 0n): bigint => {
  try {
    return value === undefined || value === null ? fallback : BigInt(String(value));
  } catch {
    return fallback;
  }
};

function entryFromDistribution(distribution: FeeDistribution): ProfileEntry {
  return {
    leaderTimeunitsAllocation: asBigInt(distribution.leaderTimeunitsAllocation).toString(),
    validatorTimeunitsAllocation: asBigInt(distribution.validatorTimeunitsAllocation).toString(),
    executionBudgetPerRound: asBigInt(distribution.executionBudgetPerRound).toString(),
    totalMessageFees: asBigInt(distribution.totalMessageFees).toString(),
    rotationsPerRound: asBigInt(distribution.rotations?.[0]).toString(),
  };
}

function mergeEntry(current: ProfileEntry | undefined, next: ProfileEntry): ProfileEntry {
  if (!current) return next;
  return {
    leaderTimeunitsAllocation: max(current.leaderTimeunitsAllocation, next.leaderTimeunitsAllocation),
    validatorTimeunitsAllocation: max(current.validatorTimeunitsAllocation, next.validatorTimeunitsAllocation),
    executionBudgetPerRound: max(current.executionBudgetPerRound, next.executionBudgetPerRound),
    totalMessageFees: max(current.totalMessageFees, next.totalMessageFees),
    rotationsPerRound: max(current.rotationsPerRound, next.rotationsPerRound),
  };
}

function max(a: string, b: string): string {
  return asBigInt(a) >= asBigInt(b) ? a : b;
}

function profileDistribution(receipt: ReceiptLike): FeeDistribution | undefined {
  return (
    receipt.data?.fee_accounting?.recommended_fee_preset?.distribution ??
    receipt.data?.fee_accounting?.fees_distribution ??
    receipt.fees?.distribution
  );
}

async function main() {
  const deployment = readJson<Deployment>(DEPLOYMENT_FILE);
  const proof = readJson<ProofFile>(PROOF_FILE);
  if (!deployment || !proof) {
    throw new Error("Missing deployment proof files; run npm run deploy:demo first.");
  }

  const { reader } = makeClients();
  const observations: Array<{ method: string; hash: `0x${string}` }> = [
    { method: "deploy", hash: deployment.deployTx.hash },
    ...deployment.assets.map((asset) => ({ method: "register_asset", hash: asset.tx.hash })),
    ...proof.flows.flatMap((flow) => [
      { method: "assess_asset", hash: flow.assessTx.hash },
      { method: "request_exposure", hash: flow.exposureTx.hash },
    ]),
  ];

  const profile: { version: 1; chainId: number; network: string; measuredAt: string; deploy?: ProfileEntry; methods: Record<string, ProfileEntry> } = {
    version: 1,
    chainId: CHAIN_ID,
    network: "studio-dev",
    measuredAt: new Date().toISOString(),
    methods: {},
  };

  for (const observation of observations) {
    const receipt = (await reader.getTransaction({ hash: observation.hash as never })) as unknown as ReceiptLike;
    if (receipt.statusName && receipt.statusName !== "FINALIZED") {
      throw new Error(`${observation.method} ${observation.hash} is ${receipt.statusName}; wait for FINALIZED before profiling.`);
    }
    const distribution = profileDistribution(receipt);
    if (!distribution) {
      throw new Error(`No finalized fee accounting found for ${observation.method} ${observation.hash}`);
    }
    const next = entryFromDistribution(distribution);
    if (observation.method === "deploy") profile.deploy = mergeEntry(profile.deploy, next);
    else profile.methods[observation.method] = mergeEntry(profile.methods[observation.method], next);
  }

  writeJson(PROFILE_FILE, profile);
  console.log(`Wrote ${PROFILE_FILE}`);
  console.log(JSON.stringify(profile, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
