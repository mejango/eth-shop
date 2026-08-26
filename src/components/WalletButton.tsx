"use client";

import { useEnsName } from "@/hooks/ens/useEnsName";
import { IS_DETERMINISTIC_BROWSER } from "@/lib/browserEnvironment";
import { cn, formatEthAddress } from "@/lib/utils";
import {
  logoutParaSession,
  ParaLocalDisconnectError,
  ParaSessionLogoutError,
} from "@/providers/para-logout";
import { useParaAuth } from "@/providers/ParaAuthContext";
import { preloadParaHost } from "@/providers/preload-para";
import { USDC_ADDRESSES, type JBChainId } from "@bananapus/nana-sdk-core";
import { getConnections } from "@wagmi/core";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type SetStateAction,
} from "react";
import { erc20Abi, formatUnits } from "viem";
import { useAccount, useBalance, useConfig, useDisconnect, useReadContract } from "wagmi";
import { Button, type ButtonProps } from "./ui/button";

// eth.shop has no single project scope (unlike revnet.money, one project per deployment)
// and no `@/app/constants` module, so this lives here rather than being imported.
const USDC_DECIMALS = 6;

type WalletConnectButtonProps = Omit<ButtonProps, "children"> & {
  label?: string;
};

const MENU_ITEM_SELECTOR = '[role="menuitem"]:not([disabled])';

function formattedWalletBalance(value: bigint, decimals: number, symbol: string) {
  return `${Number(formatUnits(value, decimals)).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })} ${symbol}`;
}

function BalanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <dt className="text-mute">{label}</dt>
      <dd className="whitespace-nowrap font-medium text-ink">{value}</dd>
    </div>
  );
}

function menuItems(menu: HTMLElement | null) {
  return Array.from(menu?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? []);
}

function useDismissableMenu(open: boolean, setOpen: Dispatch<SetStateAction<boolean>>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const initialFocusRef = useRef<"first" | "last">("first");

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;
    const items = menuItems(menuRef.current);
    const item = initialFocusRef.current === "last" ? items.at(-1) : items[0];
    (item ?? menuRef.current)?.focus();
  }, [open]);

  const openMenu = (initialFocus: "first" | "last" = "first") => {
    initialFocusRef.current = initialFocus;
    setOpen(true);
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    openMenu(event.key === "ArrowUp" ? "last" : "first");
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = menuItems(menuRef.current);
    if (!items.length) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    let nextIndex: number | undefined;
    switch (event.key) {
      case "ArrowDown":
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
        break;
      case "ArrowUp":
        nextIndex =
          currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    items[nextIndex]?.focus();
  };

  return { containerRef, menuRef, onMenuKeyDown, onTriggerKeyDown, openMenu, triggerRef };
}

export function WalletConnectButton({
  label = "Sign in",
  className,
  variant = "default",
  ...props
}: WalletConnectButtonProps) {
  const { requestSignIn } = useParaAuth();
  const [open, setOpen] = useState(false);
  const menu = useDismissableMenu(open, setOpen);

  return (
    // The sign-in sheet now carries every way in — email, phone, socials,
    // wallets — so a menu in front of it would only ask which door to use
    // twice.
    <div className="inline-flex items-center gap-3">
      <Button
        ref={menu.triggerRef}
        {...props}
        type={props.type ?? "button"}
        variant={variant}
        className={className}
        // Fetch Para's runtime as the pointer arrives, so the click has
        // nothing left to wait for.
        onMouseEnter={preloadParaHost}
        onFocus={preloadParaHost}
        onTouchStart={preloadParaHost}
        onClick={(event) => {
          props.onClick?.(event);
          if (event.defaultPrevented) return;
          requestSignIn();
        }}
      >
        {label}
      </Button>
    </div>
  );
}

export function WalletButton() {
  const { address, chain, isConnected } = useAccount();
  const config = useConfig();
  const { data: balance } = useBalance({ address });
  const usdcAddress = chain?.id ? USDC_ADDRESSES[chain.id as JBChainId] : undefined;
  const { data: usdcBalance } = useReadContract({
    abi: erc20Abi,
    address: usdcAddress,
    chainId: chain?.id,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!usdcAddress },
  });
  const { disconnectAsync, isPending } = useDisconnect();

  /**
   * End the session, whatever is holding it.
   *
   * Two things can outlive a click on Disconnect. Para's session is authoritative and survives
   * Wagmi entirely, so it is asked first — and asked whenever one EXISTS, not when the active
   * connector happens to be named "para": an email sign-in whose connector reads as anything
   * else took the plain path, failed, and left the account signed in with nothing but "the
   * wallet could not disconnect" to show for it.
   *
   * Wagmi's own disconnect can then refuse — a connector it holds but is no longer connected
   * to. Asking each live connection to go instead is what actually clears that.
   */
  const endSession = useCallback(async () => {
    if (!IS_DETERMINISTIC_BROWSER) {
      const { getParaClient } = await import("@/providers/para-config");
      const hasParaSession = await getParaClient()
        .isFullyLoggedIn()
        .catch(() => false);
      if (hasParaSession) {
        await logoutParaSession({ disconnect: disconnectAsync });
        return;
      }
    }
    try {
      await disconnectAsync();
    } catch (error) {
      const live = getConnections(config);
      if (live.length === 0) throw error;
      for (const connection of live) {
        await disconnectAsync({ connector: connection.connector });
      }
    }
  }, [disconnectAsync, config]);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string>();
  const [paraLogoutPending, setParaLogoutPending] = useState(false);
  const menuId = useId();
  const menu = useDismissableMenu(open, setOpen);
  const { data: ensName } = useEnsName(address);

  useEffect(() => setMounted(true), []);

  const formattedBalance = balance
    ? formattedWalletBalance(balance.value, balance.decimals, balance.symbol)
    : null;
  const formattedUsdcBalance =
    usdcBalance !== undefined
      ? formattedWalletBalance(usdcBalance, USDC_DECIMALS, "USDC")
      : usdcAddress
        ? "Loading…"
        : "Unavailable";

  if (!mounted || !isConnected || !address) {
    return <WalletConnectButton variant="outline" />;
  }

  return (
    <div
      className="relative inline-flex"
      ref={menu.containerRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <Button
        ref={menu.triggerRef}
        type="button"
        variant="outline"
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-expanded={open}
        onKeyDown={menu.onTriggerKeyDown}
        onClick={() => {
          if (open) setOpen(false);
          else menu.openMenu();
        }}
        className="gap-2"
      >
        {/* The state is the headline; which account is the detail. The dot belongs to the
            headline, so it sits on that line rather than centred against both. */}
        <span className="flex flex-col items-start leading-tight">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 bg-accent" aria-hidden />
            Signed in
          </span>
          <span className="pl-4 text-[11px] text-mute">
            {ensName ?? formatEthAddress(address, { truncateTo: 4 })}
          </span>
        </span>
        {/* No balance on the trigger: the menu lists every token this account holds, which
            the header only gestured at with "0 ETH". */}
      </Button>
      {open ? (
        <div
          ref={menu.menuRef}
          id={menuId}
          role="menu"
          tabIndex={-1}
          aria-label="Wallet account"
          onKeyDown={menu.onMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-2 min-w-64 border border-shelf-deep bg-paper p-1 shadow-lg"
        >
          <div className="border-b border-shelf px-3 py-2 text-xs text-mute">
            <div className="mb-1.5">{chain?.name ?? "Unsupported network"}</div>
            <dl className="space-y-1">
              <BalanceRow
                label={balance?.symbol ?? "Native"}
                value={formattedBalance ?? "Unavailable"}
              />
              <BalanceRow label="USDC" value={formattedUsdcBalance} />
            </dl>
          </div>
          <Link
            href={`/account/${address}`}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              menu.triggerRef.current?.focus();
            }}
            className="flex min-h-11 w-full items-center px-3 py-2 text-left text-sm text-ink hover:bg-shelf focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Account
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void navigator.clipboard?.writeText(address).catch(() => undefined);
              setOpen(false);
              menu.triggerRef.current?.focus();
            }}
            className="block min-h-11 w-full px-3 py-2 text-left text-sm text-ink hover:bg-shelf focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Copy address
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={isPending || paraLogoutPending}
            onClick={() => {
              setDisconnectError(undefined);
              setParaLogoutPending(true);
              void endSession()
                .then(() => setOpen(false))
                .catch((error: unknown) => {
                  setDisconnectError(
                    error instanceof ParaSessionLogoutError
                      ? "The embedded wallet could not sign out. Your session is still connected; try again."
                      : error instanceof ParaLocalDisconnectError
                        ? "You signed out, but the local wallet state did not reset. Try again or reload."
                        : "The wallet could not disconnect. Try again.",
                  );
                })
                .finally(() => setParaLogoutPending(false));
            }}
            className={cn(
              "block min-h-11 w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
            )}
          >
            {paraLogoutPending ? "Signing out…" : "Disconnect"}
          </button>
          {disconnectError ? (
            <p role="alert" className="max-w-72 border-t border-shelf px-3 py-2 text-xs text-red-700">
              {disconnectError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
