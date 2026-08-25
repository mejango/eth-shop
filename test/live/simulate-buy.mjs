#!/usr/bin/env node
// Proves the payment src/components/shop/BuyFlow.tsx encodes actually MINTS a
// 721 item, against a real deployed shop on mainnet (Banny Retail, eth.shop's
// /eth:4) — no funded wallet needed, via viem's `simulateCalls` with a
// balance state override on a throwaway payer address.
//
// Run manually: node test/live/simulate-buy.mjs
//
// Encoding mirrors BuyFlow/src/lib/pay.ts exactly:
//   - `tierIdsToMint` and `toPaymentUnits` are duplicated here verbatim from
//     src/lib/pay.ts (both ~10 lines, pure functions) since this is a plain
//     Node script, not a TS/Next build.
//   - `buildPayTx`, `build721PayMetadata`, `previewPay`, `resolvePaymentTerminal`
//     are imported straight from the same @bananapus/nana-sdk-core package
//     BuyFlow imports them from — not reimplemented.
//
// Memory note: simulateCalls takes ONE `account`, not a per-call `from` — a
// per-call `from` produces fake reverts.

import { createPublicClient, formatEther, http } from "viem";
import { mainnet } from "viem/chains";
import { jb721TiersHookAbi, jb721TiersHookStoreAbi, NATIVE_TOKEN } from "@bananapus/nana-sdk-core";
import {
  build721PayMetadata,
  buildPayTx,
  effectiveTierPrice,
  previewPay,
  resolvePaymentTerminal,
} from "@bananapus/nana-sdk-core/v6";

// Banny Retail on mainnet (eth.shop's /eth:4). hook/store/idTarget read from
// readShop's live output at http://localhost:3003/eth:4 during this task's
// verification — see task-6-report.md.
const CHAIN_ID = 1;
const PROJECT_ID = 4n;
const HOOK = "0x37e35937ecF949d7a44a9Fe878107DE264618B8f";
const STORE = "0x69913acF79DbBA170d9EfAFe605ee62B42164F9C";
const ID_TARGET = "0xf4a5887170E4d7efb1C874ad88fc82EBF076b5Ab";
const TIER_ID = 4; // "Original" Banny body — 0.0001 ETH, unlimited supply

// Any address works: its balance is state-overridden below, not actually funded.
const PAYER = "0x000000000000000000000000000000000000000f";

// Duplicated from src/lib/pay.ts `tierIdsToMint` (array of tierId repeated qty times, ascending).
function tierIdsToMint(lines) {
  const ids = [];
  for (const line of lines) {
    for (let i = 0; i < line.qty; i++) ids.push(BigInt(line.tierId));
  }
  return ids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// Duplicated from src/lib/pay.ts `toPaymentUnits` (ceil(pricingUnits * pricePerUnit / 10^pricingDecimals)).
function toPaymentUnits(pricingUnits, pricePerUnit, pricingDecimals) {
  if (pricingUnits === 0n) return 0n;
  const divisor = 10n ** BigInt(pricingDecimals);
  return (pricingUnits * pricePerUnit + divisor - 1n) / divisor;
}

const client = createPublicClient({
  chain: mainnet,
  transport: http("https://ethereum-rpc.publicnode.com"),
});

async function main() {
  const tier = await client.readContract({
    address: STORE,
    abi: jb721TiersHookStoreAbi,
    functionName: "tierOf",
    args: [HOOK, BigInt(TIER_ID), false],
  });
  const effectivePrice = effectiveTierPrice(tier.price, tier.discountPercent);
  console.log(`Tier ${TIER_ID} ("Original"): ${formatEther(effectivePrice)} ETH, discount ${tier.discountPercent}%`);

  const { address: terminal, isRouter } = await resolvePaymentTerminal(client, {
    chainId: CHAIN_ID,
    projectId: PROJECT_ID,
    token: NATIVE_TOKEN,
  });
  // Fail-closed rule BuyFlow applies: a router-only token is refused outright.
  if (isRouter) {
    throw new Error("Native ETH resolved to the router registry for this project — refusing per fail-closed rule.");
  }
  console.log(`Terminal (direct, not router): ${terminal}`);

  const tierIds = tierIdsToMint([{ tierId: TIER_ID, qty: 1 }]);

  // Banny is priced and paid in ETH: same-currency pair, so BuyFlow's
  // usePricePerUnit takes the 1:1 shortcut (10^payDecimals) rather than an
  // on-chain JBPrices read — toPaymentUnits is a pass-through here.
  const amount = toPaymentUnits(effectivePrice, 10n ** 18n, 18);

  const metadata = build721PayMetadata({
    metadataIdTarget: ID_TARGET,
    tierIdsToMint: tierIds,
    allowOverspending: false,
  });

  const preview = await previewPay(client, {
    chainId: CHAIN_ID,
    terminal,
    projectId: PROJECT_ID,
    token: NATIVE_TOKEN,
    amount,
    beneficiary: PAYER,
    metadata,
  });
  console.log(
    `Preview: ${formatEther(preview.beneficiaryTokenCount)} BANNY to beneficiary, ${formatEther(preview.reservedTokenCount)} reserved`,
  );

  const request = buildPayTx({
    chainId: CHAIN_ID,
    terminal,
    projectId: PROJECT_ID,
    token: NATIVE_TOKEN,
    amount,
    beneficiary: PAYER,
    minReturnedTokens: 0n,
    memo: "",
    metadata,
  });

  const balanceOfCall = {
    to: HOOK,
    abi: jb721TiersHookAbi,
    functionName: "balanceOf",
    args: [PAYER],
  };
  const payCall = {
    to: request.address,
    abi: request.abi,
    functionName: request.functionName,
    args: request.args,
    value: request.value,
  };

  const { results } = await client.simulateCalls({
    account: PAYER,
    calls: [balanceOfCall, payCall, balanceOfCall],
    stateOverrides: [{ address: PAYER, balance: amount + 10n ** 17n }],
  });

  const [before, payResult, after] = results;
  if (payResult.status !== "success") {
    throw new Error(`pay() reverted in simulation: ${JSON.stringify(payResult.error ?? payResult)}`);
  }

  const beforeCount = before.result;
  const afterCount = after.result;
  const expected = beforeCount + BigInt(tierIds.length);

  console.log(`pay() call status: ${payResult.status}, gas used: ${payResult.gasUsed}`);
  console.log(`balanceOf(payer) before: ${beforeCount}`);
  console.log(`balanceOf(payer) after:  ${afterCount}`);
  console.log(`expected after:          ${expected}`);

  if (afterCount !== expected) {
    throw new Error(`MINT VERIFICATION FAILED: expected balanceOf ${expected}, got ${afterCount}`);
  }

  console.log(
    `OK: encoded pay() minted ${tierIds.length} item(s) to ${PAYER} — balanceOf ${beforeCount} -> ${afterCount}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
