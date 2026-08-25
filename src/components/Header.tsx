import { WalletButton } from "@/components/WalletButton";
import Link from "next/link";

export function Header({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-shelf-deep bg-paper px-5">
      <Link href="/" className="display text-xl font-extrabold">
        eth<span className="text-accent">.</span>shop
      </Link>
      <nav className="flex items-center gap-5 text-sm">
        {right}
        <Link href="/#buy" className="font-medium hover:text-accent">
          Buy
        </Link>
        <WalletButton />
        <Link
          href="/sell"
          className="rounded-full bg-ink px-4 py-1.5 font-medium text-paper hover:bg-accent"
        >
          Sell
        </Link>
      </nav>
    </header>
  );
}
