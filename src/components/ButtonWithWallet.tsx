import { JB_CHAINS, JBChainId } from "@bananapus/nana-sdk-core";
import React from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { WalletConnectButton } from "./WalletButton";
import { Button, ButtonProps } from "./ui/button";

const ButtonWithWallet = React.forwardRef<
  HTMLButtonElement,
  {
    connectWalletText?: string;
    targetChainId?: JBChainId;
    children: React.ReactNode;
    forceChildren?: boolean;
  } & ButtonProps
>(({ children, connectWalletText, targetChainId, forceChildren, ...props }, ref) => {
  const userChainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();

  if (!isConnected) {
    return (
      <WalletConnectButton
        {...props}
        onClick={undefined}
        label={connectWalletText ?? "Connect Wallet"}
      />
    );
  }

  if (typeof targetChainId !== "undefined" && userChainId !== targetChainId) {
    return (
      <Button
        {...props}
        onClick={async (e) => {
          e.preventDefault();
          await switchChainAsync({ chainId: targetChainId });
          props.onClick?.(e);
        }}
        loading={isPending}
      >
        {forceChildren ? children : `Switch to ${JB_CHAINS[targetChainId].name}`}
      </Button>
    );
  }

  return (
    <Button ref={ref} {...props}>
      {children}
    </Button>
  );
});

ButtonWithWallet.displayName = "ButtonWithWallet";

export { ButtonWithWallet };
