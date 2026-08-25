"use client";

import { Header } from "@/components/Header";
import { WalletButton } from "@/components/WalletButton";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAccount } from "wagmi";

export default function AccountIndex() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  useEffect(() => {
    if (isConnected && address) router.replace(`/account/${address}`);
  }, [address, isConnected, router]);
  return (
    <>
      <Header />
      <div className="px-5 py-20">
        <h1 className="display text-4xl font-extrabold">Your items</h1>
        <p className="mt-3 text-mute">Connect a wallet to see what you hold.</p>
        <div className="mt-6">
          <WalletButton />
        </div>
      </div>
    </>
  );
}
