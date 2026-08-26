import { WalletButton } from "@/components/WalletButton";
import Link from "next/link";

export function Header({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-shelf-deep bg-paper px-5">
      <Link href="/" className="display text-xl font-extrabold">
        eth<span className="text-accent">.</span>shop
      </Link>
      <nav className="flex items-center gap-3 text-sm">
        {right}
        <WalletButton />
        <Link
          href="/sell"
          className="rounded-md bg-accent px-4 py-2 font-medium hover:bg-accent-ink"
        >
          Open a shop
        </Link>
      </nav>
    </header>
  );
}
