/** Re-read every recorded proof transaction from Studio Next and enrich demo-proof.json. */
import { PROOF_FILE, readConsensusDetails, readJson, writeFrontendProof, writeJson, type TxOutcome } from "./lib.ts";

type Proof = Parameters<typeof writeFrontendProof>[0] & { flows: { name: string; assessTx: TxOutcome; exposureTx: TxOutcome }[] };
const proof = readJson<Proof>(PROOF_FILE);
if (!proof) throw new Error("demo-proof.json missing; run npm run seed");
for (const flow of proof.flows) {
  for (const tx of [flow.assessTx, flow.exposureTx]) {
    const d = await readConsensusDetails(tx.hash);
    if (d.statusName) tx.statusName = d.statusName;
    if (d.executionResultName) tx.executionResultName = d.executionResultName;
    tx.validators = d.validators;
    tx.votes = d.votes;
    if (!tx.successful) tx.errorText = d.errorText;
    console.log(`${flow.name.padEnd(46)} ${tx.hash.slice(0, 12)}… ${d.statusName}/${d.executionResultName} validators=${d.validators} ${tx.errorText ?? ""}`);
  }
}
writeJson(PROOF_FILE, proof);
writeFrontendProof(proof);
