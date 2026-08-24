import type { Item } from "@/lib/fixtures";
import Link from "next/link";

export function Art({ hue, className = "" }: { hue: number; className?: string }) {
  // ponytail: placeholder artwork until tier media resolves from IPFS.
  return (
    <div
      className={`aspect-square w-full ${className}`}
      style={{ background: `linear-gradient(160deg, hsl(${hue} 50% 88%), hsl(${hue} 40% 72%))` }}
    />
  );
}

export function ItemCard({ item, showShop }: { item: Item; showShop?: boolean }) {
  const soldOut = item.left === 0;
  return (
    <Link href={`/${item.shop}?item=${item.id}`} className="group block" scroll={false}>
      <Art
        hue={item.hue}
        className="rounded-sm transition-transform group-hover:-translate-y-0.5"
      />
      <div className="tag mt-3 flex items-baseline justify-between gap-3 pt-2">
        <span className="font-sans text-sm leading-tight">{item.name}</span>
        <span
          className={`shrink-0 text-lg font-semibold ${soldOut ? "text-mute line-through" : ""}`}
        >
          {item.price} ETH
        </span>
      </div>
      <div className="mt-1 flex justify-between text-xs text-mute">
        <span>{showShop ? `eth.shop/${item.shop}` : item.kind}</span>
        <span>
          {soldOut ? "sold out" : item.left !== undefined ? `${item.left} left` : "unlimited"}
        </span>
      </div>
    </Link>
  );
}
