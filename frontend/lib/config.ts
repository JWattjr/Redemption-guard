import deployment from "./deployment.generated.json";

export const STUDIO_NEXT = {
  name: "Studio Next",
  cliNetwork: "studio-dev",
  chainId: 61997,
  chainIdHex: "0xf22d",
  rpcUrl: "https://studio-dev.genlayer.com/api",
  explorerUrl: "https://explorer-studio-dev.genlayer.com",
} as const;

const fromEnv = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.trim();

export const CONTRACT_ADDRESS = (fromEnv && /^0x[0-9a-fA-F]{40}$/.test(fromEnv)
  ? fromEnv
  : deployment.contractAddress) as `0x${string}`;

export const DEPLOYED_AT = deployment.deployedAt;

export const FIXTURE_BASE_URL = (process.env.NEXT_PUBLIC_FIXTURE_BASE_URL ?? deployment.fixtureBaseUrl).replace(/\/$/, "");

export const FIXTURES = [
  {
    key: "operational",
    label: "Operational",
    assetId: "NWUSD",
    url: `${FIXTURE_BASE_URL}/evidence/northwind-redemptions-operational.html`,
    hint: "NWUSD issuer notice: redemptions fully operational",
  },
  {
    key: "suspended",
    label: "Suspended",
    assetId: "HLUSD",
    url: `${FIXTURE_BASE_URL}/evidence/halcyon-redemptions-suspended.html`,
    hint: "HLUSD issuer notice: all redemptions suspended",
  },
  {
    key: "unclear",
    label: "Ambiguous",
    assetId: "HLUSD",
    url: `${FIXTURE_BASE_URL}/evidence/halcyon-status-unclear.html`,
    hint: "HLUSD update that does not confirm redemption status",
  },
] as const;

export const explorerTx = (hash: string) => `${STUDIO_NEXT.explorerUrl}/tx/${hash}`;
export const explorerAddress = (address: string) => `${STUDIO_NEXT.explorerUrl}/address/${address}`;
