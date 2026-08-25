"use client";
import { requireOnchainExecution, useWriteContract } from "@/hooks/useReviewedWriteContract";
import { useAllowance } from "@/hooks/useAllowance";
import { useShopCredits, usePricePerUnit } from "@/hooks/useShopPurchase";
import { formatPrice } from "@/lib/items";
import {
  amountDue,
  cartTotal,
  creditsApplicable,
  isExactConversion,
  minReturnedTokens,
  roundUp,
  tierIdsToMint,
  toPaymentUnits,
  type CartLine,
} from "@/lib/pay";
import type { Shop } from "@/lib/types";
import { explorerBaseUrl, formatWalletError } from "@/lib/utils";
import { isTransactionReceiptUnavailableError, waitForReceiptWithRetry } from "@/lib/waitForReceipt";
import { NATIVE_TOKEN, jb721TiersHookAbi } from "@bananapus/nana-sdk-core";
import { build721PayMetadata, buildPayTx, previewPay, resolvePaymentTerminal } from "@bananapus/nana-sdk-core/v6";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, parseEventLogs, type Address, type Hex } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { ButtonWithWallet } from "@/components/ButtonWithWallet";
import { TxSteps } from "@/components/ui/TxSteps";

type AcceptedToken = Shop["acceptedTokens"][number];
type PayableToken = AcceptedToken & { terminal: Address };

export type BuyFlowLine = CartLine & { name: string };

type BuyPhase =
  | "preparing"
  | "ready"
  | "approving"
  | "simulating"
  | "signing"
  | "pending"
  | "verifying"
  | "success"
  | "unverified";

// The floor applied to the previewed project-token return, matching
// revnet-money's V6PayCard slippage tolerance (1%).
const SLIPPAGE_BPS = 100n;
const IN_FLIGHT: readonly BuyPhase[] = ["approving", "simulating", "signing", "pending", "verifying"];

const primary =
  "rounded-full px-4 py-2 text-sm font-medium bg-accent text-paper hover:bg-accent-ink disabled:bg-shelf-deep disabled:text-mute w-full py-3 text-lg";
const ghost =
  "rounded-full px-4 py-2 text-sm font-medium border border-ink hover:bg-shelf disabled:border-shelf-deep disabled:text-mute";

function isNativeToken(token: Address): boolean {
  return token.toLowerCase() === NATIVE_TOKEN.toLowerCase();
}

export function BuyFlow({
  shop,
  lines,
  onClose,
  onPurchased,
  chainPicker,
}: {
  shop: Shop;
  lines: BuyFlowLine[];
  onClose: () => void;
  onPurchased: (tokenIds: bigint[]) => void;
  /** Rendered on the review screen when the shop spans chains; switching remounts BuyFlow (keyed by chain). */
  chainPicker?: React.ReactNode;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: shop.chainId });
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectId = BigInt(shop.projectId);

  const [phase, setPhase] = useState<BuyPhase>("preparing");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex>();
  const [roundUpChecked, setRoundUpChecked] = useState(false);
  const [payableTokens, setPayableTokens] = useState<PayableToken[] | null>(null);
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<Address | undefined>(
    () => shop.acceptedTokens.find((t) => isNativeToken(t.token))?.token ?? shop.acceptedTokens[0]?.token,
  );
  const [prepared, setPrepared] = useState<{ preview: { beneficiaryTokenCount: bigint } } | null>(null);
  const [mintedTokenIds, setMintedTokenIds] = useState<bigint[]>([]);
  // Synchronous re-entrancy guard for confirm(): React state updates are
  // batched/async, so a fast double-click could invoke confirm() twice
  // before `phase` (and the button's disabled prop) re-renders. A ref reads
  // and writes immediately, closing that window.
  const submittingRef = useRef(false);

  const currentToken = useMemo(
    () => payableTokens?.find((t) => t.token === selectedTokenAddress) ?? payableTokens?.[0],
    [payableTokens, selectedTokenAddress],
  );

  const { credits } = useShopCredits(shop.chainId, shop.hook, address);
  const creditsBn = credits ?? 0n;
  const tierIds = useMemo(() => tierIdsToMint(lines), [lines]);
  const dueInPricingUnits = useMemo(() => amountDue(lines, creditsBn), [lines, creditsBn]);

  const pricingCurrency = BigInt(shop.pricingCurrency);
  const {
    pricePerUnit,
    unavailable: priceUnavailable,
    isLoading: priceLoading,
  } = usePricePerUnit(
    shop.chainId,
    projectId,
    currentToken ? BigInt(currentToken.currency) : undefined,
    pricingCurrency,
    currentToken?.decimals,
  );

  const previewAmountDue = useMemo(() => {
    if (pricePerUnit === null || pricePerUnit === undefined || !currentToken) return null;
    return toPaymentUnits(dueInPricingUnits, pricePerUnit, shop.decimals);
  }, [pricePerUnit, currentToken, dueInPricingUnits, shop.decimals]);

  // Always mirrors the shop's own preventOverspending flag, never the
  // round-up checkbox: the hook ANDs this metadata bit with
  // `!flagsOf(hook).preventOverspending` (JB721TiersHookLib.prepareMint), so
  // sending `false` when the shop allows overspending would still revert on
  // any leftover — and leftover is unavoidable for fractional/discounted/
  // cross-currency prices or excess credits, independent of round-up.
  const finalMetadata = useMemo((): Hex => {
    if (tierIds.length === 0) return "0x";
    return build721PayMetadata({
      metadataIdTarget: shop.idTarget,
      tierIdsToMint: tierIds,
      allowOverspending: !shop.flags.preventOverspending,
    });
  }, [tierIds, shop.idTarget, shop.flags.preventOverspending]);

  const finalPaymentAmount = useMemo(() => {
    if (previewAmountDue === null || !currentToken) return null;
    return roundUpChecked && !shop.flags.preventOverspending
      ? roundUp(previewAmountDue, currentToken.decimals)
      : previewAmountDue;
  }, [previewAmountDue, roundUpChecked, shop.flags.preventOverspending, currentToken]);

  const minReturnedDisplay = prepared ? minReturnedTokens(prepared.preview.beneficiaryTokenCount, SLIPPAGE_BPS) : null;

  const blockedReason = useMemo(() => {
    if (lines.length === 0) return "Your cart is empty.";
    if (shop.acceptedTokens.length === 0) return "This shop hasn't set up payments yet.";
    if (payableTokens !== null && payableTokens.length === 0) {
      // Router-only tokens are already filtered out of payableTokens (never
      // shown as a choice); this is the "none left" case — same binding copy
      // buildPayTx's own callers use for a router-required item checkout.
      return "Item checkout requires a directly accepted token.";
    }
    if (!currentToken) return null; // still resolving payable tokens
    if (!priceLoading && pricePerUnit === null) return `This shop can't be paid in ${currentToken.symbol}.`;
    if (!priceLoading && pricePerUnit === undefined && priceUnavailable) {
      return "Couldn't load pricing. Try again.";
    }
    if (
      shop.flags.preventOverspending &&
      !priceLoading &&
      pricePerUnit !== null &&
      pricePerUnit !== undefined &&
      dueInPricingUnits > 0n &&
      !isExactConversion(dueInPricingUnits, pricePerUnit, shop.decimals)
    ) {
      return `This shop requires exact payment and this price can't be matched exactly in ${currentToken.symbol}.`;
    }
    return null;
  }, [
    lines.length,
    shop.acceptedTokens.length,
    shop.flags.preventOverspending,
    shop.decimals,
    payableTokens,
    currentToken,
    priceLoading,
    pricePerUnit,
    priceUnavailable,
    dueInPricingUnits,
  ]);

  // No reviewedInParent here: the approval spend (spender + amount + token)
  // is not shown anywhere in BuyFlow's own checkout screen, so the ERC-20
  // approve call must run through the reviewed hook's own in-app review
  // dialog rather than skip it.
  const { ensureAllowance, getApprovalReceipt } = useAllowance(shop.chainId);
  const { writeContractAsync } = useWriteContract({ reviewedInParent: true });

  // Step 1: resolve which accepted tokens actually have a directly-payable
  // terminal (not the router registry fallback) — runs once. A router-only
  // token is refused outright rather than shown as a choice; see the module
  // note on fail-closed rules.
  useEffect(() => {
    if (payableTokens !== null) return;
    if (!publicClient) return;
    if (shop.acceptedTokens.length === 0) {
      setPayableTokens([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const resolved = await Promise.all(
          shop.acceptedTokens.map(async (t) => {
            const r = await resolvePaymentTerminal(publicClient, { chainId: shop.chainId, projectId, token: t.token });
            return { ...t, terminal: r.address, isRouter: r.isRouter };
          }),
        );
        if (cancelled) return;
        setPayableTokens(resolved.filter((t) => !t.isRouter));
      } catch (err) {
        if (cancelled) return;
        setError(formatWalletError(err, "Couldn't check how this shop accepts payment."));
        setPayableTokens([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicClient, payableTokens, shop.acceptedTokens, shop.chainId, projectId]);

  // Step 2: once a payable token is selected and priced, take a live preview
  // (of the FULL amount that will actually be sent, including round-up — see
  // finding 5), then move to the review phase. The balanceOf snapshot used
  // to verify the purchase is taken later, inside confirm() immediately
  // before signing (finding 5) — not here, where it could go stale.
  useEffect(() => {
    if (phase !== "preparing") return;
    if (!address || !publicClient) return;
    if (payableTokens === null) return;
    if (!currentToken) {
      setPhase("ready");
      return;
    }
    if (priceLoading) return;
    if (finalPaymentAmount === null) {
      setPhase("ready");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const preview = await previewPay(publicClient, {
          chainId: shop.chainId,
          terminal: currentToken.terminal,
          projectId,
          token: currentToken.token,
          amount: finalPaymentAmount,
          beneficiary: address,
          metadata: finalMetadata,
        });
        if (cancelled) return;
        setPrepared({ preview });
        setPhase("ready");
      } catch (err) {
        if (cancelled) return;
        setError(formatWalletError(err, "Couldn't prepare this purchase."));
        setPhase("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, address, publicClient, payableTokens, currentToken, priceLoading, finalPaymentAmount, finalMetadata, shop.chainId, projectId]);

  // Tracked in a ref (not a dependency of the effect below) so that effect
  // reacts ONLY to finalPaymentAmount changing — not to every phase
  // transition. Depending on `phase` there too would re-fire this same
  // effect the instant confirm()'s catch block sets phase to "ready" and
  // reports an error, wiping that error back out via setError(null) in the
  // same tick.
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // The floor shown to the buyer (`prepared.preview.beneficiaryTokenCount`)
  // must never disagree with the amount actually signed. Reset to
  // `preparing` whenever the amount that will be sent changes for any
  // reason — credits resolving late, the round-up checkbox, or a token
  // switch — so the live preview effect above re-runs against the new
  // amount (finding 3). Skipped while a transaction is actually in flight
  // or already resolved; those phases hold their values fixed.
  useEffect(() => {
    const current = phaseRef.current;
    if (IN_FLIGHT.includes(current) || current === "success" || current === "unverified") return;
    setPrepared(null);
    setError(null);
    setPhase("preparing");
  }, [finalPaymentAmount]);

  function selectToken(token: Address) {
    if (phase !== "ready" && phase !== "preparing") return;
    setSelectedTokenAddress(token);
  }

  function toggleRoundUp(checked: boolean) {
    if (phase !== "ready") return;
    setRoundUpChecked(checked);
  }

  async function confirm() {
    if (submittingRef.current) return;
    if (!currentToken || !prepared || !address || !publicClient || finalPaymentAmount === null) return;
    submittingRef.current = true;
    setError(null);
    try {
      // Re-resolve the terminal and re-preview immediately before signing.
      // `preparing`'s batch resolution / preview can be stale by the time the
      // buyer actually confirms (the primary terminal can repoint, the price
      // can move) — the values that feed buildPayTx's terminal and
      // minReturnedTokens must come from a fresh read, never a cached one.
      // A router-only re-resolution fails closed into the catch block below
      // (stays in `ready`, shows an error line) rather than signing against
      // a stale, no-longer-valid direct terminal.
      const resolved = await resolvePaymentTerminal(publicClient, {
        chainId: shop.chainId,
        projectId,
        token: currentToken.token,
      });
      if (resolved.isRouter) {
        throw new Error("Item checkout requires a directly accepted token.");
      }
      const freshPreview = await previewPay(publicClient, {
        chainId: shop.chainId,
        terminal: resolved.address,
        projectId,
        token: currentToken.token,
        amount: finalPaymentAmount,
        beneficiary: address,
        metadata: finalMetadata,
      });
      // The displayed "you'll receive at least" floor came from `prepared`'s
      // earlier preview. If the fresh, about-to-be-signed preview has
      // dropped more than the same 1% slippage tolerance below it, the rate
      // moved enough that signing now would silently accept a lower floor
      // than what the buyer reviewed — fail closed instead.
      if (freshPreview.beneficiaryTokenCount < minReturnedTokens(prepared.preview.beneficiaryTokenCount, SLIPPAGE_BPS)) {
        throw new Error("The rate moved. Review the updated quote.");
      }

      let approvalBlock: bigint | undefined;
      if (!isNativeToken(currentToken.token)) {
        setPhase("approving");
        const approvalHash = await ensureAllowance(currentToken.token, resolved.address, finalPaymentAmount);
        const receipt = approvalHash ? getApprovalReceipt(approvalHash) : undefined;
        if (receipt?.blockNumber !== undefined) approvalBlock = receipt.blockNumber;
      }

      const minReturned = minReturnedTokens(freshPreview.beneficiaryTokenCount, SLIPPAGE_BPS);
      const request = buildPayTx({
        chainId: shop.chainId,
        terminal: resolved.address,
        projectId,
        token: currentToken.token,
        amount: finalPaymentAmount,
        beneficiary: address,
        minReturnedTokens: minReturned,
        memo: "",
        metadata: finalMetadata,
      });

      setPhase("simulating");
      await publicClient.simulateContract({
        address: request.address,
        abi: request.abi,
        functionName: request.functionName,
        args: request.args,
        value: request.value,
        account: address,
        blockNumber: approvalBlock,
      } as unknown as Parameters<typeof publicClient.simulateContract>[0]);

      // Snapshot balanceOf immediately before signing — not during
      // `preparing`, which can run long before the buyer actually confirms
      // and go stale (finding 5).
      const before = (await publicClient.readContract({
        address: shop.hook,
        abi: jb721TiersHookAbi,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;

      setPhase("signing");
      const hash = await writeContractAsync({
        chainId: shop.chainId,
        address: request.address,
        abi: request.abi,
        functionName: request.functionName,
        args: request.args,
        value: request.value,
      } as unknown as Parameters<typeof writeContractAsync>[0]);
      setTxHash(hash);
      requireOnchainExecution(hash, "Purchase");

      setPhase("pending");
      const receipt = await waitForReceiptWithRetry(publicClient, hash);
      if (receipt.status !== "success") {
        throw new Error(`Purchase ${hash} reverted onchain.`);
      }

      setPhase("verifying");
      const after = (await publicClient.readContract({
        address: shop.hook,
        abi: jb721TiersHookAbi,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;

      const transfers = parseEventLogs({ abi: jb721TiersHookAbi, eventName: "Transfer", logs: receipt.logs });
      const mintedIds = transfers
        .filter(
          (log) =>
            log.address.toLowerCase() === shop.hook.toLowerCase() && log.args.to.toLowerCase() === address.toLowerCase(),
        )
        .map((log) => log.args.tokenId);

      if (after <= before || mintedIds.length === 0) {
        // Payment went through but nothing is verifiably minted to this
        // wallet — either the balance didn't move (it may have landed as
        // credits instead, e.g. a sold-out tier mid-flight) or it did move
        // without a decodable Transfer log to show for it. Either way,
        // never report success for zero verified items.
        queryClient.invalidateQueries({ queryKey: ["shopCredits", shop.chainId, shop.hook, address] });
        setPhase("unverified");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["ownedCount", shop.chainId, shop.hook, address] });
      queryClient.invalidateQueries({ queryKey: ["shopCredits", shop.chainId, shop.hook, address] });
      router.refresh();

      setMintedTokenIds(mintedIds);
      setPhase("success");
      onPurchased(mintedIds);
    } catch (err) {
      if (isTransactionReceiptUnavailableError(err)) {
        setPhase("pending");
        setError(err.message);
        return;
      }
      setPhase("ready");
      setError(formatWalletError(err, "Couldn't complete this purchase."));
    } finally {
      submittingRef.current = false;
    }
  }

  const busy = IN_FLIGHT.includes(phase);
  const explorer = explorerBaseUrl(shop.chainId);
  const txLink = txHash && explorer ? `${explorer}/tx/${txHash}` : undefined;

  const hasApproveStep = !!currentToken && !isNativeToken(currentToken.token);
  const steps = [
    ...(hasApproveStep ? [{ key: "approve", title: `Approve ${currentToken!.symbol}` }] : []),
    { key: "confirm", title: "Confirm purchase" },
    { key: "pending", title: "Waiting for the chain" },
    { key: "verify", title: "Checking your item" },
  ];
  const activeIndex = (() => {
    const offset = hasApproveStep ? 1 : 0;
    switch (phase) {
      case "approving":
        return 0;
      case "simulating":
      case "signing":
        return offset;
      case "pending":
        return offset + 1;
      case "verifying":
        return offset + 2;
      case "success":
      case "unverified":
        return offset + 3;
      default:
        return 0;
    }
  })();

  const total = cartTotal(lines);
  const creditUsed = creditsApplicable(lines, creditsBn);
  const buyDisabled =
    phase !== "ready" || !!blockedReason || !prepared || finalPaymentAmount === null || lines.length === 0;

  return (
    <BuyDialog onClose={onClose} busy={busy}>
      <div className="p-6">
        <h2 className="display text-2xl font-extrabold">Check out</h2>

        {phase === "success" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm">
              Purchased. You received {mintedTokenIds.length} item{mintedTokenIds.length === 1 ? "" : "s"}.
            </p>
            {txLink && (
              <a href={txLink} target="_blank" rel="noreferrer" className="text-xs underline">
                View transaction
              </a>
            )}
            <button type="button" className={primary} onClick={onClose}>
              Done
            </button>
          </div>
        ) : phase === "unverified" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm">
              Payment went through but no item was minted — contact the shop.
            </p>
            {txLink && (
              <a href={txLink} target="_blank" rel="noreferrer" className="text-xs underline">
                View transaction
              </a>
            )}
            <button type="button" className={ghost} onClick={onClose}>
              Close
            </button>
          </div>
        ) : IN_FLIGHT.includes(phase) ? (
          <div className="mt-4 space-y-4">
            <TxSteps steps={steps} activeIndex={activeIndex} />
            {txLink && (
              <a href={txLink} target="_blank" rel="noreferrer" className="text-xs underline">
                View transaction
              </a>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {chainPicker}
            <ul className="space-y-2 text-sm">
              {lines.map((line) => (
                <li key={line.tierId} className="flex justify-between gap-3">
                  <span>
                    {line.name}
                    {line.qty > 1 && <span className="text-mute"> ×{line.qty}</span>}
                  </span>
                  <span className="font-mono">
                    {formatPrice(line.effectivePrice * BigInt(line.qty), shop.decimals, shop.currency)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="tag grid grid-cols-2 gap-y-1 pt-3 text-sm">
              <dt className="text-mute">Items</dt>
              <dd className="text-right font-mono">{formatPrice(total, shop.decimals, shop.currency)}</dd>
              {creditsBn > 0 && (
                <>
                  <dt className="text-mute">Credit applied</dt>
                  <dd className="text-right font-mono">
                    −{formatPrice(creditUsed, shop.decimals, shop.currency)}
                  </dd>
                </>
              )}
            </dl>

            {payableTokens && payableTokens.length > 1 && (
              <fieldset className="flex flex-wrap gap-2">
                <legend className="mb-1 w-full text-xs text-mute">Pay with</legend>
                {payableTokens.map((t) => (
                  <button
                    key={t.token}
                    type="button"
                    className={t.token === currentToken?.token ? `${ghost} border-ink` : ghost}
                    onClick={() => selectToken(t.token)}
                  >
                    {t.symbol}
                  </button>
                ))}
              </fieldset>
            )}

            {currentToken && finalPaymentAmount !== null && (
              <p className="text-sm">
                You pay{" "}
                <b className="font-mono">
                  {formatUnits(finalPaymentAmount, currentToken.decimals)} {currentToken.symbol}
                </b>
              </p>
            )}

            {!shop.flags.preventOverspending && currentToken && previewAmountDue !== null ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-accent"
                  checked={roundUpChecked}
                  onChange={(e) => toggleRoundUp(e.target.checked)}
                />
                Round up to {formatUnits(roundUp(previewAmountDue, currentToken.decimals), currentToken.decimals)}{" "}
                {currentToken.symbol}; the extra stays as credit for next time
              </label>
            ) : (
              <p className="text-xs text-mute">This shop requires exact payment.</p>
            )}

            {minReturnedDisplay !== null && (
              <p className="text-xs text-mute">
                You&apos;ll receive at least {formatUnits(minReturnedDisplay, 18)} {shop.symbol || "shop"} tokens.
              </p>
            )}

            {blockedReason && <p className="text-xs text-red-600">{blockedReason}</p>}
            {error && <p className="text-xs text-red-600">{error}</p>}
            {!blockedReason && !prepared && !error && address && (
              <p className="text-xs text-mute">Still calculating</p>
            )}

            <ButtonWithWallet
              targetChainId={shop.chainId}
              // Only gate the actual buy action, not the "Connect Wallet"
              // fallback ButtonWithWallet renders before a wallet is
              // connected — that one must always stay clickable.
              disabled={!!address && buyDisabled}
              loading={phase === "preparing" && !!address}
              className={primary}
              onClick={() => void confirm()}
            >
              Buy
            </ButtonWithWallet>
          </div>
        )}
      </div>
    </BuyDialog>
  );
}

function BuyDialog({
  children,
  onClose,
  busy,
}: {
  children: React.ReactNode;
  onClose: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      onClose={() => {
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (!busy && e.target === ref.current) ref.current?.close();
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-md bg-paper p-0 backdrop:bg-ink/60"
    >
      {children}
      {!busy && (
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-paper/80 text-lg hover:bg-shelf"
        >
          ×
        </button>
      )}
    </dialog>
  );
}
