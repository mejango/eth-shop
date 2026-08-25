# Testing

eth.shop treats every wallet-signed transaction as a safety boundary: the reviewed write
wrapper is the only place a raw wagmi/viem write, send, or signature call is allowed to
appear, and every economic action built on top of it must map to an executable test.

## Local commands

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run env:test
npm run wallet-writes:check
npm run build
```

`npm run check` runs that sequence in order (typecheck, lint, test, env:test,
wallet-writes:check, then `next build`). `npm run dev` starts the app on port 3003.

## Wallet-writes inventory

`src/hooks/useReviewedWriteContract.ts` wraps wagmi's `useWriteContract`: before any
call reaches the wallet, it re-checks the connected account, runs the app's
transaction-review confirmation, re-checks the account again, simulates the call, and
only then submits and tracks the result. It is the single boundary every wallet write
goes through — no production module calls a raw `writeContract`, `sendTransaction`, or
`signTypedData` outside it.

`npm run wallet-writes:check` (`scripts/check-wallet-write-sites.mjs`) scans every
production TypeScript module with the TypeScript compiler API, and:

- rejects any raw wallet write/send/sign call or wallet-send RPC method outside
  `src/hooks/useReviewedWriteContract.ts`;
- diffs the discovered call sites (file, owning function, call name, count) against the
  pinned inventory in `test/fixtures/wallet-write-sites.json`, so an added, removed, or
  moved wallet-write call site fails the check until the fixture and this document are
  updated together;
- requires every discovered site to map to exactly one named action in that fixture, and
  requires every money-moving or project-control action to name a test file that contains
  a literal `wallet-action:<id>` marker — a broad boundary test alone cannot cover a new
  economic action.

| Surface                                                                | Implementation                | Safety coverage                                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Central direct write boundary <!-- wallet-inventory:central-write -->    | `useReviewedWriteContract.ts` | Account re-check before and after review, simulation immediately before submission, duplicate-submission rejection, and receipt tracking. |
| Shop purchase and token approval <!-- wallet-inventory:shop-purchase --> | `BuyFlow.tsx`, `useAllowance.ts` | Purchase amount, tier ids, and slippage floor (`shop-purchase`); approval spend amount (`token-approval`) are both pinned by `test/pay.test.ts`, marked `wallet-action:shop-purchase` and `wallet-action:token-approval`. |

Today's complete inventory is two production writes: `BuyFlow.tsx`'s `confirm` calls
`pay()` on the resolved terminal, and `useAllowance.ts`'s `ensureAllowance` calls
`approve()` on the accepted ERC-20 when it isn't native ETH. `WalletButton.tsx` only
connects/disconnects a wallet and never writes.

When adding a wallet write: call it through `useWriteContract` from
`@/hooks/useReviewedWriteContract` (never wagmi's own hook or a raw viem action), add the
new site to the matching surface and action in `test/fixtures/wallet-write-sites.json`,
and add an executable `wallet-action:<id>` test that covers the amount/args it sends
onchain.

## Running a purchase manually

The unit suite (`npm test`) covers pure math only — cart totals, credit application,
pricing-unit conversion, slippage floor, and round-up — never a live wallet or RPC.
To prove the real `pay()` encoding mints an item, run:

```sh
node test/live/simulate-buy.mjs
```

This calls a real deployed shop (Banny Retail, `eth.shop`'s `/eth:4`, mainnet) with
viem's `simulateCalls` and a balance override on a throwaway address — no funded wallet
required. It builds the same `pay()` call `BuyFlow.tsx` builds (via the same
`@bananapus/nana-sdk-core` encoders) and asserts the buyer's 721 balance increases by
one. Run it after any change to `src/lib/pay.ts`, `BuyFlow.tsx`'s payment encoding, or
the `nana-sdk-core` pin.

To exercise the full signed flow end to end: `npm run dev`, connect a funded wallet
(Para or an injected/WalletConnect wallet — see the README's wallet section) on a chain
with a live shop, open a shop page, add an item to the cart, and click Buy. Watch the
step viewer move through Approve (if the token isn't native) → Confirm purchase →
Waiting for the chain → Checking your item, and confirm the item appears on `/account`.
